// Agent run tracing.
//
// Every agent invocation opens a row in agent_runs and writes one agent_steps
// row per node it touches. Those tables are in the Realtime publication, so a
// browser subscribed to them watches the agent think in real time — this module
// is both the observability layer and the event source for the client-facing
// workflow visualisation.
//
// Tracing must never take the pipeline down: writes are best-effort and log
// rather than throw.

import { sb } from "../db.mjs";
import { assertNode } from "./graph.mjs";
import { modelInfo, DEFAULT_MODEL } from "./models.mjs";

/**
 * Token usage reaches us in different dialects — LangChain's `usage_metadata`
 * and the AI SDK's camelCase (which Mastra forwards), plus the snake_case form
 * most providers return raw. Normalise so cost accounting is identical
 * whichever engine ran.
 */
export function normalizeUsage(usage) {
  if (!usage) return null;
  const u = usage.usage_metadata ?? usage;
  const input = u.input_tokens ?? u.inputTokens ?? u.promptTokens ?? 0;
  const output = u.output_tokens ?? u.outputTokens ?? u.completionTokens ?? 0;
  const cacheRead =
    u.cache_read_input_tokens ??
    u.cachedInputTokens ??
    u.input_token_details?.cache_read ??
    0;
  return { input_tokens: input, output_tokens: output, cache_read_input_tokens: cacheRead };
}

export function costOf(model, usage = {}) {
  const p = modelInfo(model);
  if (!p) return 0;
  const u = normalizeUsage(usage) ?? {};
  const input = u.input_tokens ?? 0;
  const output = u.output_tokens ?? 0;
  const cacheRead = u.cache_read_input_tokens ?? 0;
  return (input * p.input + output * p.output + cacheRead * p.cacheRead) / 1_000_000;
}

class Tracer {
  constructor(run) {
    this.run = run;
    this.seq = 0;
    this.totals = { input: 0, output: 0, cacheRead: 0, cost: 0 };
    this.startedAt = Date.now();
  }

  get id() {
    return this.run?.id ?? null;
  }

  /**
   * Open a step. Returns handles to close it — call exactly one of
   * ok() / fail() / skip(). A step that is never closed stays "running",
   * which is itself a useful signal in the UI.
   */
  async step(node, { kind = "tool", label = null, input = null } = {}) {
    if (!this.run) return noopStep;
    assertNode(this.run.workflow, node);
    const seq = ++this.seq;
    const startedAt = Date.now();
    const { data, error } = await sb
      .from("agent_steps")
      .insert({
        run_id: this.run.id,
        seq,
        node,
        kind,
        label,
        input,
        status: "running",
        demo: this.run.demo,
      })
      .select("id")
      .maybeSingle();
    if (error) {
      console.error("trace.step:", error.message);
      return noopStep;
    }

    const close = async (patch) => {
      const { error: e } = await sb
        .from("agent_steps")
        .update({ ...patch, ended_at: new Date().toISOString(), latency_ms: Date.now() - startedAt })
        .eq("id", data.id);
      if (e) console.error("trace.close:", e.message);
    };

    return {
      id: data.id,
      ok: (output = null, usage = null) => {
        const u = normalizeUsage(usage);
        if (u) this.addUsage(u);
        return close({
          status: "ok",
          output,
          input_tokens: u?.input_tokens ?? 0,
          output_tokens: u?.output_tokens ?? 0,
          cost_usd: u ? costOf(this.run.model, u) : 0,
        });
      },
      fail: (err) => close({ status: "error", error: String(err?.message ?? err).slice(0, 2000) }),
      skip: (why = null) => close({ status: "skipped", output: why ? { reason: why } : null }),
    };
  }

  addUsage(usage) {
    const u = normalizeUsage(usage);
    if (!u) return;
    this.totals.input += u.input_tokens;
    this.totals.output += u.output_tokens;
    this.totals.cacheRead += u.cache_read_input_tokens;
    this.totals.cost += costOf(this.run.model, u);
  }

  async finish(status, output = null, error = null) {
    if (!this.run) return;
    const { error: e } = await sb
      .from("agent_runs")
      .update({
        status,
        output,
        error: error ? String(error?.message ?? error).slice(0, 2000) : null,
        ended_at: new Date().toISOString(),
        latency_ms: Date.now() - this.startedAt,
        input_tokens: this.totals.input,
        output_tokens: this.totals.output,
        cache_read_tokens: this.totals.cacheRead,
        cost_usd: this.totals.cost.toFixed(6),
      })
      .eq("id", this.run.id);
    if (e) console.error("trace.finish:", e.message);
  }
}

const noopStep = {
  id: null,
  ok: async () => {},
  fail: async () => {},
  skip: async () => {},
};

/** Open a run. Returns a Tracer; never throws. */
export async function startRun({
  agentSlug,
  workflow,
  trigger = "manual",
  model = DEFAULT_MODEL,
  engine = "mastra",
  phone10 = null,
  conversationId = null,
  leadId = null,
  input = {},
  demo = false,
}) {
  const { data, error } = await sb
    .from("agent_runs")
    .insert({
      agent_slug: agentSlug,
      workflow,
      trigger,
      model,
      engine,
      phone10,
      conversation_id: conversationId,
      lead_id: leadId,
      input,
      demo,
      status: "running",
    })
    .select()
    .maybeSingle();
  if (error) {
    console.error("trace.startRun:", error.message);
    return new Tracer(null);
  }
  return new Tracer({ ...data, workflow, model, demo });
}
