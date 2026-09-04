// Tools the WhatsApp agent can call.
//
// Engine-agnostic on purpose. This module returns plain specs —
// { name, description, schema, node, run } — and each engine adapter in
// engines/ converts them into whatever shape it needs (Mastra createTool,
// LangChain tool). The `run` returned here is already wrapped in tracing, so
// every engine produces an identical trace.
//
// Built per-run so every tool call can write a step onto that run's trace.
// In demo mode the side-effecting tools (send, escalate, update) are simulated:
// the step is still recorded — so the visualisation looks identical — but no
// real message leaves the system.

import { z } from "zod";
import { sb, recentMessages, upsertLead, windowOpen } from "../db.mjs";
import { sendText, sendTemplate } from "../wa.mjs";

export const EMBED_MODEL = "gemini-embedding-001";
/** Must match the policies.embedding column, which is vector(1024). */
export const EMBED_DIMS = 1024;

/**
 * Embed one string as a 1024-dim vector, matching the policies.embedding column.
 *
 * Gemini is preferred: it returns exactly 1024 dims via outputDimensionality
 * and reuses the Google key the agent already needs, so playbook search costs
 * no extra vendor. Voyage stays as a fallback for existing installs.
 *
 * `task` matters for retrieval quality — documents and queries are embedded
 * into the same space but with different task hints.
 *
 * @param {string} text
 * @param {"document"|"query"} task
 * @returns {Promise<number[]|null>} null when no provider is configured
 */
export async function embed(text, task = "query") {
  const googleKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY;
  if (googleKey) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent?key=${googleKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: `models/${EMBED_MODEL}`,
          content: { parts: [{ text }] },
          taskType: task === "document" ? "RETRIEVAL_DOCUMENT" : "RETRIEVAL_QUERY",
          outputDimensionality: EMBED_DIMS,
        }),
      }
    );
    if (res.ok) {
      const data = await res.json();
      return data?.embedding?.values ?? null;
    }
    console.error("gemini embed failed:", res.status, (await res.text()).slice(0, 200));
  }

  const voyageKey = process.env.VOYAGE_API_KEY;
  if (!voyageKey) return null;
  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${voyageKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "voyage-3.5",
      input: [text],
      input_type: task === "document" ? "document" : "query",
    }),
  });
  if (!res.ok) {
    console.error("voyage embed failed:", res.status);
    return null;
  }
  const data = await res.json();
  return data?.data?.[0]?.embedding ?? null;
}


/**
 * Playbook retrieval. Uses pgvector when embeddings are configured and falls
 * back to keyword matching otherwise, so the agent still works before the
 * knowledge base has been embedded.
 */
async function searchPlaybook(query, limit = 5) {
  const vector = await embed(query);
  if (vector) {
    const { data, error } = await sb.rpc("match_policies", {
      query_embedding: vector,
      match_count: limit,
      similarity_threshold: 0.25,
    });
    if (!error) return { mode: "vector", results: data ?? [] };
    console.error("match_policies:", error.message);
  }
  const { data, error } = await sb
    .from("policies")
    .select("id, title, rule, category")
    .eq("active", true)
    .or(`title.ilike.%${query}%,rule.ilike.%${query}%`)
    .limit(limit);
  if (error) throw new Error(`searchPlaybook: ${error.message}`);
  return { mode: "keyword", results: data ?? [] };
}

/**
 * @param {object} ctx
 * @param {object} ctx.tracer   run tracer
 * @param {string|(() => string|null)} ctx.phone10
 *   The customer. WhatsApp and voice know who they are talking to before the
 *   run opens, so they pass a string. A website visitor is anonymous until
 *   they hand over a number mid-conversation, so the web channel passes a
 *   getter and every tool resolves it at call time instead of at build time.
 * @param {boolean} ctx.demo    simulate side effects
 * @param {object} [ctx.outcome] mutated with what the agent actually did —
 *   the reply text as sent, whether it escalated, and (voice only) whether it
 *   asked to end the call. Read this rather than the model's trailing prose:
 *   engines return whatever text the model happened to emit last, which is
 *   empty when the turn ends on a tool call.
 * @param {"whatsapp"|"voice"|"web"} [ctx.channel] which reply tool to expose —
 *   send_whatsapp_reply for WhatsApp, speak_reply + end_call for voice, and
 *   none for web (the Live API speaks natively, so a reply tool would only
 *   duplicate what the model is already saying aloud).
 * @returns {Array<{name: string, description: string, schema: import('zod').ZodTypeAny, node: string, label: string, run: (input: object) => Promise<object>}>}
 */
export function buildToolSpecs({ tracer, phone10, demo = false, outcome = {}, channel = "whatsapp" }) {
  /** The customer's number right now — see the ctx.phone10 note above. */
  const who = () => (typeof phone10 === "function" ? phone10() : phone10);
  // One reply per turn, enforced here rather than in the prompt.
  //
  // The prompt asks for exactly one send_whatsapp_reply, and models do not
  // reliably obey: Gemini 3.1 Flash-Lite was observed calling it eight times on
  // an angry refund message, and LangGraph then blew its recursion limit.
  // A side effect that spends money and messages a real customer cannot
  // depend on instruction-following, so the second call is refused and the
  // model is told to stop. Set only after a send actually succeeds, so a
  // genuine failure can still be retried.
  let replySent = false;

  /**
   * Wrap an implementation as a traced step on the given graph node.
   * Errors are returned as data rather than thrown: a tool failure should let
   * the agent recover and say something useful, not abort the run.
   */
  const traced = (node, label, fn) => async (input) => {
    const step = await tracer.step(node, { kind: "tool", label, input });
    try {
      const output = await fn(input);
      await step.ok(output);
      return output;
    } catch (err) {
      await step.fail(err);
      return { error: String(err.message ?? err) };
    }
  };

  return [
    {
      name: "get_conversation_history",
      node: "context",
      label: "Load thread history",
      description:
        "Read the recent message history for this conversation. Use it when the customer " +
        "refers to something said earlier and it is not already in your context.",
      schema: z.object({
        limit: z.number().int().min(1).max(50).optional().describe("How many messages, default 20"),
      }),
      run: traced("context", "Load thread history", async ({ limit }) =>
        // A demo run has no thread, and must not create one just by looking.
        demo || !who() ? { messages: [] } : { messages: await recentMessages(who(), limit ?? 20) }
      ),
    },

    {
      name: "search_playbook",
      node: "playbook",
      label: "Search playbook",
      description:
        "Search the client's approved playbook — pricing, offers, delivery terms, refund rules, " +
        "escalation triggers. Call this before making any factual claim about the business. " +
        "If nothing relevant comes back, say you will check with the team rather than guessing.",
      schema: z.object({
        query: z.string().describe("What you need to know, in natural language"),
      }),
      run: traced("playbook", "Search playbook", async ({ query }) => searchPlaybook(query)),
    },

    {
      name: "update_lead",
      node: "lead",
      label: "Update lead",
      description:
        "Record what you learned about this lead: their name, and their stage — " +
        "'new', 'qualified' (they have a real need and budget), 'nurture' (interested, not now), " +
        "or 'lost' (not a fit). Call this whenever the conversation reveals either.",
      schema: z.object({
        name: z.string().optional().describe("The customer's name, if they gave it"),
        status: z.enum(["new", "qualified", "nurture", "lost"]).optional(),
        note: z.string().optional().describe("One line on why"),
      }),
      run: traced("lead", "Update lead", async ({ name, status, note }) => {
        if (demo) return { updated: false, simulated: true, name, status, note };
        const lead = await upsertLead(who(), { name, status });
        return { updated: true, lead_id: lead?.id ?? null, name, status, note };
      }),
    },

    ...(channel === "voice"
      ? [
          {
            name: "speak_reply",
            node: "speak",
            label: "Speak reply",
            description:
              "Say something to the caller — this text is spoken aloud by text-to-speech, not read. " +
              "Use short, plain spoken sentences: no lists, no markdown, no headings. Say numbers and " +
              "prices the way a person would say them. Mirror the caller's language. Never invent facts " +
              "that are not in the playbook. Call this exactly once per turn, as your final action.",
            schema: z.object({
              text: z.string().max(600).describe("What to say, as plain spoken words"),
            }),
            run: traced("speak", "Speak reply", async ({ text }) => {
              if (replySent) {
                return {
                  spoken: false,
                  already_replied: true,
                  error:
                    "You have already sent your one reply for this turn. Do not send another. " +
                    "Stop calling tools and end your turn now.",
                };
              }
              replySent = true;
              outcome.reply = text;
              return { spoken: !demo, simulated: demo, text };
            }),
          },
          {
            name: "end_call",
            node: "speak",
            label: "End call",
            description:
              "Close out the call after you've said your goodbye with speak_reply. Use this once the " +
              "conversation has reached a natural end — the caller says bye, confirms nothing else is " +
              "needed, or you've escalated and told them a human will follow up.",
            schema: z.object({
              reason: z.string().describe("Why the call is ending, one short phrase"),
            }),
            run: traced("speak", "End call", async ({ reason }) => {
              outcome.endCall = true;
              return { ending: true, reason };
            }),
          },
        ]
      : []),

    // The web channel has no reply tool at all: the Live API speaks the answer
    // itself, so exposing one would only let the model say everything twice.
    ...(channel === "whatsapp"
      ? [
          {
            name: "send_whatsapp_reply",
            node: "reply",
            label: "Send reply",
            description:
              "Send a WhatsApp message to the customer. Write in the same language and script the " +
              "customer used (Hindi in Devanagari, Hinglish in Latin script, English in English). " +
              "Keep it under 400 characters and never invent facts that are not in the playbook. " +
              "Call this exactly once per turn, as your final action.",
            schema: z.object({
              text: z.string().max(1000).describe("The message body"),
            }),
            run: traced("reply", "Send reply", async ({ text }) => {
              if (replySent) {
                return {
                  sent: false,
                  already_replied: true,
                  error:
                    "You have already sent your one reply for this turn. Do not send another. " +
                    "Stop calling tools and end your turn now.",
                };
              }
              if (demo) {
                replySent = true;
                outcome.reply = text;
                return { sent: false, simulated: true, text };
              }
              const open = await windowOpen(who());
              if (!open) {
                // Outside the 24h service window only approved templates are allowed.
                const r = await sendTemplate(
                  who(),
                  process.env.WA_DEFAULT_TEMPLATE ?? "hi_intro",
                  "en",
                  [],
                  "agent"
                );
                replySent = true;
                outcome.reply = text;
                return { sent: true, mode: "template", reason: "24h window closed", messageId: r.messageId };
              }
              const r = await sendText(who(), text, "agent");
              replySent = true;
              outcome.reply = text;
              return { sent: true, mode: "text", messageId: r.messageId, text };
            }),
          },
        ]
      : []),

    {
      name: "escalate_to_human",
      node: "escalate",
      label: "Escalate to human",
      description:
        "Hand this conversation to a human. Use it when the customer is angry, asks for a " +
        "person, raises a legal or payment dispute, or asks something the playbook does not " +
        "cover. After escalating, send one short message telling the customer a human is coming.",
      schema: z.object({
        reason: z.string().describe("Why this needs a human, one sentence"),
        urgency: z.enum(["normal", "high"]).optional(),
      }),
      run: traced("escalate", "Escalate to human", async ({ reason, urgency }) => {
        outcome.escalated = true;
        if (demo) return { escalated: false, simulated: true, reason, urgency: urgency ?? "normal" };
        // A website visitor may still be anonymous. The escalation is real —
        // it is on the run, which the dashboard lists — but there is no thread
        // to flag yet, and `.eq("phone10", null)` would silently match nothing.
        if (!who())
          return { escalated: true, thread_flagged: false, reason, urgency: urgency ?? "normal" };
        const { error } = await sb
          .from("conversations")
          .update({ human_handoff: true, status: "needs_human" })
          .eq("phone10", who());
        if (error) throw new Error(error.message);
        return { escalated: true, reason, urgency: urgency ?? "normal" };
      }),
    },
  ];
}

export { searchPlaybook };
