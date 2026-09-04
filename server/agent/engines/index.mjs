// Engine registry.
//
// Three orchestrators, one contract:
//
//   run({ tracer, specs, offer, userMessage, model })
//     -> { reply: string, stopReason: string|null, refused: boolean }
//
// Each is responsible for opening and closing its own "reason" steps; tool
// steps come free, because the specs from tools.mjs are already traced. That
// is what lets one React Flow visualisation render any of them.
//
// Imports are lazy and per-engine: LangGraph and Mastra are heavy, and a
// broken or uninstalled framework must not stop the other two from running.

const LOADERS = {
  mastra: () => import("./mastra.mjs"),
  langgraph: () => import("./langgraph.mjs"),
};

// Which providers each engine can reach. Declared statically so compatibility
// can be checked without importing a heavy framework.
//
// A third engine, `runner`, used to sit here — the Anthropic SDK's own tool
// runner. It was deleted along with the rest of the Anthropic integration:
// it spoke the Messages API directly and could not reach any other provider.
const PROVIDERS = {
  mastra: ["google"],
  langgraph: ["google"],
};

export const ENGINE_IDS = Object.keys(LOADERS);

export const engineSupports = (engineId, provider) =>
  (PROVIDERS[engineId] ?? []).includes(provider);

/** First engine that can reach this provider, preferring the configured default. */
export function engineFor(provider, preferred = null) {
  if (preferred && engineSupports(preferred, provider)) return preferred;
  const fallback = defaultEngineId();
  if (engineSupports(fallback, provider)) return fallback;
  return ENGINE_IDS.find((e) => engineSupports(e, provider)) ?? fallback;
}

/** Production default. Override per-run, or globally with AGENT_ENGINE. */
export const defaultEngineId = () => {
  const want = process.env.AGENT_ENGINE ?? "mastra";
  if (!LOADERS[want]) {
    console.warn(`Unknown AGENT_ENGINE "${want}" — falling back to mastra`);
    return "mastra";
  }
  return want;
};

const cache = new Map();

/** Load an engine module, or throw a message worth showing a user. */
export async function loadEngine(engineId) {
  const id = LOADERS[engineId] ? engineId : defaultEngineId();
  if (!cache.has(id)) cache.set(id, LOADERS[id]());
  try {
    return await cache.get(id);
  } catch (err) {
    cache.delete(id); // a transient import failure shouldn't be sticky
    throw new Error(`Engine "${id}" failed to load: ${err.message}`);
  }
}

/**
 * Engines that actually import on this machine, with their descriptions.
 * Served to the site so the demo can offer only what is installed.
 */
export async function engineCatalog() {
  const entries = await Promise.all(
    ENGINE_IDS.map(async (engineId) => {
      try {
        const m = await loadEngine(engineId);
        return {
          id: m.id,
          label: m.label,
          blurb: m.blurb,
          providers: PROVIDERS[engineId] ?? [],
          available: true,
        };
      } catch (err) {
        console.warn(`engine ${engineId} unavailable:`, err.message);
        return {
          id: engineId,
          label: engineId,
          blurb: null,
          providers: PROVIDERS[engineId] ?? [],
          available: false,
        };
      }
    })
  );
  return entries;
}
