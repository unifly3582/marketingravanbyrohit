// The WhatsApp lead responder.
//
// This module owns everything that is *not* the agent loop: opening the run,
// the guards, the tools, the prompt, and closing the trace. The loop itself is
// delegated to one of the interchangeable engines (see engines/index.mjs) —
// Mastra or LangGraph.
//
// They share the prompt, the tools and the tracer, so a run looks identical in
// the UI whichever one produced it, and switching is an env var.

import { conversationId, windowOpen } from "../db.mjs";
import { buildToolSpecs } from "./tools.mjs";
import { currentOffer, userTurn, voiceUserTurn } from "./prompt.mjs";
import { startRun } from "./trace.mjs";
import { loadEngine, engineSupports, engineFor } from "./engines/index.mjs";
import { requireModel, productionModel, demoModel } from "./models.mjs";

/** Per-channel workflow/graph wiring — see agent/graph.mjs for the node lists. */
const CHANNEL = {
  whatsapp: {
    workflow: "whatsapp-responder",
    agentSlug: "whatsapp-responder",
    triggerNode: "inbound",
    triggerLabel: "Inbound message",
    defaultTrigger: "whatsapp_inbound",
  },
  voice: {
    workflow: "voice-responder",
    agentSlug: "voice-responder",
    triggerNode: "inbound-audio",
    triggerLabel: "Caller utterance",
    defaultTrigger: "voice_inbound",
  },
};

/**
 * Handle one inbound turn — a WhatsApp message, or one transcribed caller
 * utterance on a phone call. Same brain, same playbook, same trace either way;
 * only the prompt, the reply tool and the graph nodes differ (see tools.mjs
 * and prompt.mjs's `channel` param).
 *
 * @param {object} args
 * @param {"whatsapp"|"voice"} [args.channel]
 * @param {string} args.phone10       customer's 10-digit number
 * @param {string} args.text          what they said (or, for voice, the STT transcript)
 * @param {string} [args.contactName]
 * @param {string} [args.trigger]     defaults per channel — see CHANNEL above
 * @param {boolean} [args.demo]       simulate side effects, make the run public
 * @param {string} [args.engine]      'mastra' | 'langgraph'
 * @param {string} [args.model]       overrides AGENT_MODEL for this run
 * @param {(runId: string|null) => void} [args.onStart]
 *   Fired as soon as the run row exists, before any model call. Lets a caller
 *   hand the id to a browser (or a live call) that wants to watch/use the run
 *   as soon as it exists. Always fires exactly once, with null if the run
 *   could not be opened.
 * @returns {Promise<{runId: string|null, status: string, reply: string, escalated?: boolean, endCall?: boolean, engine: string, model: string}>}
 */
export async function runAgent({
  channel = "whatsapp",
  phone10,
  text,
  contactName = null,
  trigger = null,
  demo = false,
  engine = null,
  model = null,
  onStart = null,
}) {
  const cfg = CHANNEL[channel] ?? CHANNEL.whatsapp;
  const runTrigger = trigger ?? cfg.defaultTrigger;

  // A demo run defaults to the demo model, not the production one — otherwise
  // any caller that forgets to pass a model quietly bills anonymous traffic at
  // production rates.
  const modelId = model ?? (demo ? demoModel() : productionModel());
  // Unknown model, or an engine that cannot reach its provider, is a
  // configuration error — fail before spending anything.
  const info = requireModel(modelId);
  const engineId = engine ?? engineFor(info.provider);
  if (!engineSupports(engineId, info.provider)) {
    const err = new Error(
      `Engine "${engineId}" cannot run "${modelId}" (provider: ${info.provider}).`
    );
    console.error(`${channel} agent:`, err.message);
    onStart?.(null);
    return { runId: null, status: "failed", reply: "", engine: engineId, model: modelId };
  }

  let tracer;
  try {
    const convId = demo ? null : await conversationId(phone10, contactName);
    tracer = await startRun({
      agentSlug: cfg.agentSlug,
      workflow: cfg.workflow,
      trigger: runTrigger,
      model: modelId,
      engine: engineId,
      phone10,
      conversationId: convId,
      input: { text, contact_name: contactName },
      demo,
    });
  } catch (err) {
    console.error(`${channel} agent: could not open run:`, err.message);
    onStart?.(null);
    return { runId: null, status: "failed", reply: "", engine: engineId, model: modelId };
  }
  onStart?.(tracer.id);

  try {
    const inbound = await tracer.step(cfg.triggerNode, {
      kind: "trigger",
      label: cfg.triggerLabel,
      input: { from: phone10, text, engine: engineId, model: modelId },
    });
    await inbound.ok({ received: true });

    // The 24h free-form-text window is a WhatsApp Business API rule — it has
    // no meaning on a phone call, so voice skips this guard entirely.
    if (channel === "whatsapp") {
      const guard = await tracer.step("window", { kind: "guard", label: "24h window check" });
      const open = demo ? true : await windowOpen(phone10);
      await guard.ok({ window_open: open, mode: open ? "free-form text" : "approved template only" });
    }

    const [offer, engineModule] = await Promise.all([currentOffer(), loadEngine(engineId)]);
    // `outcome` is filled in by the tools: the reply as actually sent/spoken,
    // whether the thread was escalated, and (voice only) whether the model
    // asked to end the call. Authoritative over the model's trailing text.
    const outcome = { reply: null, escalated: false, endCall: false };
    const specs = buildToolSpecs({ tracer, phone10, demo, outcome, channel });

    const userMessage =
      channel === "voice" ? voiceUserTurn(contactName, phone10, text) : userTurn(contactName, phone10, text);

    const result = await engineModule.run({
      tracer,
      specs,
      offer,
      model: modelId,
      userMessage,
      channel,
    });

    const reply = outcome.reply ?? result.reply ?? "";

    const done = await tracer.step("done", { kind: "output", label: "Run complete" });
    await done.ok({
      engine: engineId,
      model: modelId,
      escalated: outcome.escalated,
      end_call: outcome.endCall,
      stop_reason: result.stopReason,
      cost_usd: Number(tracer.totals.cost.toFixed(6)),
      tokens: { in: tracer.totals.input, out: tracer.totals.output },
    });

    await tracer.finish(result.refused ? "failed" : "succeeded", {
      reply,
      escalated: outcome.escalated,
      end_call: outcome.endCall,
      stop_reason: result.stopReason,
      engine: engineId,
      model: modelId,
    });
    return {
      runId: tracer.id,
      status: result.refused ? "failed" : "succeeded",
      reply,
      escalated: outcome.escalated,
      endCall: !!outcome.endCall,
      engine: engineId,
      model: modelId,
    };
  } catch (err) {
    console.error(`${channel} agent (${engineId}):`, err.message);
    await tracer.finish("failed", null, err);
    return { runId: tracer.id, status: "failed", reply: "", engine: engineId, model: modelId };
  }
}

/** Backward-compatible name: the WhatsApp responder specifically. */
export async function runWhatsAppAgent(args) {
  return runAgent({ ...args, channel: "whatsapp" });
}
