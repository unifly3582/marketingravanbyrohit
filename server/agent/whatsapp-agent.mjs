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
import { currentOffer, userTurn } from "./prompt.mjs";
import { startRun } from "./trace.mjs";
import { loadEngine, engineSupports, engineFor } from "./engines/index.mjs";
import { requireModel, productionModel, demoModel } from "./models.mjs";

/**
 * Handle one inbound WhatsApp message.
 *
 * @param {object} args
 * @param {string} args.phone10       customer's 10-digit number
 * @param {string} args.text          what they said
 * @param {string} [args.contactName]
 * @param {string} [args.trigger]     'whatsapp_inbound' | 'demo' | 'manual'
 * @param {boolean} [args.demo]       simulate side effects, make the run public
 * @param {string} [args.engine]      'runner' | 'mastra' | 'langgraph'
 * @param {string} [args.model]       overrides AGENT_MODEL for this run
 * @param {(runId: string|null) => void} [args.onStart]
 *   Fired as soon as the run row exists, before any model call. Lets a caller
 *   hand the id to a browser that wants to watch the run live. Always fires
 *   exactly once, with null if the run could not be opened.
 * @returns {Promise<{runId: string|null, status: string, reply: string, engine: string}>}
 */
export async function runWhatsAppAgent({
  phone10,
  text,
  contactName = null,
  trigger = "whatsapp_inbound",
  demo = false,
  engine = null,
  model = null,
  onStart = null,
}) {
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
    console.error("whatsapp agent:", err.message);
    onStart?.(null);
    return { runId: null, status: "failed", reply: "", engine: engineId, model: modelId };
  }

  let tracer;
  try {
    const convId = demo ? null : await conversationId(phone10, contactName);
    tracer = await startRun({
      agentSlug: "whatsapp-responder",
      workflow: "whatsapp-responder",
      trigger,
      model: modelId,
      engine: engineId,
      phone10,
      conversationId: convId,
      input: { text, contact_name: contactName },
      demo,
    });
  } catch (err) {
    console.error("whatsapp agent: could not open run:", err.message);
    onStart?.(null);
    return { runId: null, status: "failed", reply: "", engine: engineId, model: modelId };
  }
  onStart?.(tracer.id);

  try {
    const inbound = await tracer.step("inbound", {
      kind: "trigger",
      label: "Inbound message",
      input: { from: phone10, text, engine: engineId, model: modelId },
    });
    await inbound.ok({ received: true });

    const guard = await tracer.step("window", { kind: "guard", label: "24h window check" });
    const open = demo ? true : await windowOpen(phone10);
    await guard.ok({ window_open: open, mode: open ? "free-form text" : "approved template only" });

    const [offer, engineModule] = await Promise.all([currentOffer(), loadEngine(engineId)]);
    // `outcome` is filled in by the tools: the reply as actually sent, and
    // whether the thread was escalated. Authoritative over the model's text.
    const outcome = { reply: null, escalated: false };
    const specs = buildToolSpecs({ tracer, phone10, demo, outcome });

    const result = await engineModule.run({
      tracer,
      specs,
      offer,
      model: modelId,
      userMessage: userTurn(contactName, phone10, text),
    });

    const reply = outcome.reply ?? result.reply ?? "";

    const done = await tracer.step("done", { kind: "output", label: "Run complete" });
    await done.ok({
      engine: engineId,
      model: modelId,
      escalated: outcome.escalated,
      stop_reason: result.stopReason,
      cost_usd: Number(tracer.totals.cost.toFixed(6)),
      tokens: { in: tracer.totals.input, out: tracer.totals.output },
    });

    await tracer.finish(result.refused ? "failed" : "succeeded", {
      reply,
      escalated: outcome.escalated,
      stop_reason: result.stopReason,
      engine: engineId,
      model: modelId,
    });
    return {
      runId: tracer.id,
      status: result.refused ? "failed" : "succeeded",
      reply,
      escalated: outcome.escalated,
      engine: engineId,
      model: modelId,
    };
  } catch (err) {
    console.error(`whatsapp agent (${engineId}):`, err.message);
    await tracer.finish("failed", null, err);
    return { runId: tracer.id, status: "failed", reply: "", engine: engineId, model: modelId };
  }
}
