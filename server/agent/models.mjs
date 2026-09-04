// Model registry: provider, price and capability quirks.
//
// One place, because two different things depend on it:
//   1. Cost accounting in trace.mjs.
//   2. Which request parameters an engine is allowed to send.
//
// This project runs on Google Gemini only. Anthropic was removed deliberately;
// if it ever comes back, it needs its own provider branch in both engines, and
// the `runner` engine (deleted) would have to be restored from git history.
//
// Prices are USD per million tokens, from Google's own pricing page
// (checked 2026-09-04). Update them here and cost accounting follows.

export const MODELS = {
  // --- Flash: better judgement, for real customers -------------------------
  // Promotional pricing through 2026-12-31; input/output DOUBLE to $1.50/$7.50
  // on 2027-01-01. Revisit the production default before then.
  "gemini-3.8-flash": {
    provider: "google",
    label: "Gemini 3.8 Flash",
    input: 0.75, output: 3.75, cacheRead: 0.075,
    thinking: null, effort: false, promptCaching: false, refusalFallbacks: false,
  },
  "gemini-2.5-flash": {
    provider: "google",
    label: "Gemini 2.5 Flash",
    input: 0.3, output: 2.5, cacheRead: 0.03,
    thinking: null, effort: false, promptCaching: false, refusalFallbacks: false,
  },

  // --- Flash-Lite: cheapest, for the public demo ---------------------------
  // NOTE: gemini-2.5-flash-lite ($0.10/$0.40) is deliberately absent. It is
  // still listed as stable in the docs and returned by the models.list
  // endpoint, but generateContent 404s with "no longer available to new
  // users" — verified 2026-09-04. Do not add it back without testing a live
  // call; a default that 404s is worse than a slightly dearer one that works.
  "gemini-3.1-flash-lite": {
    provider: "google",
    label: "Gemini 3.1 Flash-Lite",
    input: 0.25, output: 1.5, cacheRead: 0.025,
    thinking: null,
    effort: false,
    promptCaching: false, // implicit/context caching only — not a cache_control path
    refusalFallbacks: false,
  },
  "gemini-3.5-flash-lite": {
    provider: "google",
    label: "Gemini 3.5 Flash-Lite",
    input: 0.3, output: 2.5, cacheRead: 0.03,
    thinking: null, effort: false, promptCaching: false, refusalFallbacks: false,
  },

  // --- Live: realtime audio in and out, for the website voice agent ---------
  // bidiGenerateContent only — this one cannot be used by mastra or langgraph,
  // and voice/web-session.mjs talks to it over its own WebSocket.
  //
  // Google prices this by modality: text is $0.75/$4.50, audio is $3.00/$12.00
  // (checked 2026-09-05). A voice session is overwhelmingly audio, and the
  // tracer's cost model is a single flat rate per model, so the audio rate is
  // what is recorded here. That over-states spend on the text tokens, which is
  // the safe direction to be wrong in for a daily cost cap.
  "gemini-3.1-flash-live-preview": {
    provider: "google",
    label: "Gemini 3.1 Flash Live",
    input: 3.0, output: 12.0, cacheRead: 0.3,
    thinking: null, effort: false, promptCaching: false, refusalFallbacks: false,
    realtime: true,
  },
};

/** Realtime audio conversations — the only model here that speaks. */
export const DEFAULT_LIVE_MODEL = "gemini-3.1-flash-live-preview";
export const liveModel = () => process.env.AGENT_LIVE_MODEL ?? DEFAULT_LIVE_MODEL;

/** Real customers: Flash rather than Flash-Lite — it has to judge escalation. */
export const DEFAULT_MODEL = "gemini-3.8-flash";
/** Anonymous demo traffic: cheapest model that actually serves. */
export const DEFAULT_DEMO_MODEL = "gemini-3.1-flash-lite";

/** Registry entry for a model id, or null if we don't know it. */
export const modelInfo = (id) => MODELS[id] ?? null;

export const providerOf = (id) => MODELS[id]?.provider ?? "google";

export const productionModel = () => process.env.AGENT_MODEL ?? DEFAULT_MODEL;
export const demoModel = () =>
  process.env.AGENT_DEMO_MODEL ?? process.env.AGENT_MODEL ?? DEFAULT_DEMO_MODEL;

/**
 * Reject unknown models loudly rather than billing at a guessed rate or
 * sending parameters the provider will refuse.
 */
export function requireModel(id) {
  const info = MODELS[id];
  if (!info) {
    throw new Error(
      `Unknown model "${id}". Known: ${Object.keys(MODELS).join(", ")}. ` +
        `Add it to agent/models.mjs with its price and capabilities first.`
    );
  }
  return info;
}

/**
 * Human-readable list for the API/UI.
 *
 * Realtime models are excluded: the public demo lets a visitor pick a model for
 * a Mastra/LangGraph run, and those engines call generateContent, which a
 * bidi-only model does not serve. Offering it would only hand someone a 404.
 */
export const modelCatalog = () =>
  Object.entries(MODELS)
    .filter(([, m]) => !m.realtime)
    .map(([id, m]) => ({
      id,
      label: m.label,
      provider: m.provider,
      input: m.input,
      output: m.output,
    }));
