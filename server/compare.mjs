// Model/engine bench.
//
//   node compare.mjs                       # every runnable pair
//   node compare.mjs gemini-3.8-flash      # one model, all its engines
//
// Runs the real agent — real prompt, real tools, real loop — across model and
// engine pairs and prints the reply, the tools it called, and what it cost.
// Answers the question the demo can't: is the cheap model good enough?
//
// Standalone on purpose: it uses an in-memory tracer and a fixture playbook, so
// it needs no Supabase and writes nothing. The only requirement is the API key
// for whichever provider you are benching.

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dir = dirname(fileURLToPath(import.meta.url));
const envFile = join(dir, ".env");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    if (!line.includes("=") || line.trim().startsWith("#")) continue;
    const k = line.slice(0, line.indexOf("=")).trim();
    const v = line.slice(line.indexOf("=") + 1).trim();
    if (v && !(k in process.env)) process.env[k] = v;
  }
}
// db.mjs refuses to load without these; the bench never reaches Postgres.
process.env.SUPABASE_URL ||= "https://bench.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY ||= "bench";

const { buildToolSpecs } = await import("./agent/tools.mjs");
const { costOf, normalizeUsage } = await import("./agent/trace.mjs");
const { MODELS, modelInfo } = await import("./agent/models.mjs");
const { ENGINE_IDS, engineSupports, loadEngine } = await import("./agent/engines/index.mjs");

// ---------------------------------------------------------------- fixtures

/** Stands in for the `policies` table so grounding can actually be judged. */
const PLAYBOOK = [
  { title: "Website pricing", category: "pricing", rule: "Websites start at ₹45,000 for a 5-page mobile-first build, delivered in 3 weeks. E-commerce starts at ₹1,20,000." },
  { title: "Retainer pricing", category: "pricing", rule: "Social media + WhatsApp automation retainer is ₹35,000/month, minimum 3 months." },
  { title: "Refunds", category: "policy", rule: "No refunds after work has begun. Disputes go to a human within one business day — never promise a refund yourself." },
  { title: "Languages", category: "general", rule: "We work in English, Hindi and Marathi. Voice agents also support Tamil and Telugu." },
];

const EXAMPLES = [
  { id: "pricing-hinglish", text: "Kitna charge karte ho website ke liye?", expect: "quotes ₹45,000 from the playbook, replies in Hinglish" },
  { id: "qualify-english", text: "We run a 12-store retail chain in Pune. Can you handle our Instagram + WhatsApp?", expect: "qualifies the lead, quotes the ₹35,000/mo retainer" },
  { id: "refund-angry", text: "I paid last month and nobody replied. I want a refund.", expect: "ESCALATES, does not promise a refund" },
  { id: "hindi-devanagari", text: "क्या आप हिंदी में भी काम करते हैं?", expect: "replies in Devanagari, confirms Hindi" },
];

// ------------------------------------------------------------ in-memory trace

function benchTracer(model) {
  const state = { steps: [], totals: { input: 0, output: 0, cacheRead: 0, cost: 0 } };
  const close = (rec) => (status, output, usage) => {
    rec.status = status;
    rec.output = output;
    const u = normalizeUsage(usage);
    if (u) {
      state.totals.input += u.input_tokens;
      state.totals.output += u.output_tokens;
      state.totals.cacheRead += u.cache_read_input_tokens;
      state.totals.cost += costOf(model, u);
    }
  };
  return {
    state,
    totals: state.totals,
    async step(node, { kind = "tool", label = null, input = null } = {}) {
      const rec = { node, kind, label, input, status: "running" };
      state.steps.push(rec);
      const done = close(rec);
      return {
        ok: async (output = null, usage = null) => done("ok", output, usage),
        fail: async (err) => done("error", { error: String(err?.message ?? err) }),
        skip: async () => done("skipped", null),
      };
    },
  };
}

/** Swap the Postgres-backed playbook for the fixture. */
function withFixturePlaybook(specs) {
  const spec = specs.find((s) => s.name === "search_playbook");
  const original = spec.run;
  spec.run = async ({ query }) => {
    await original({ query }).catch(() => {}); // keep the trace step
    const q = String(query ?? "").toLowerCase();
    const hits = PLAYBOOK.filter((p) =>
      `${p.title} ${p.rule} ${p.category}`.toLowerCase().split(/\W+/).some((w) => w && q.includes(w))
    );
    return { mode: "fixture", results: hits.length ? hits : PLAYBOOK };
  };
  return specs;
}

// ------------------------------------------------------------------- runner

async function runOne({ model, engine, example }) {
  const tracer = benchTracer(model);
  const specs = withFixturePlaybook(buildToolSpecs({ tracer, phone10: "9000000000", demo: true }));
  const mod = await loadEngine(engine);
  const started = Date.now();
  try {
    const result = await mod.run({
      tracer,
      specs,
      offer: null,
      model,
      userMessage: `WhatsApp message from Demo visitor:\n\n${example.text}`,
    });
    const sent = tracer.state.steps.find((s) => s.node === "reply");
    return {
      ok: true,
      ms: Date.now() - started,
      reply: sent?.output?.text || result.reply || "(no reply sent)",
      tools: tracer.state.steps.filter((s) => s.kind === "tool").map((s) => s.node),
      escalated: tracer.state.steps.some((s) => s.node === "escalate" && s.status === "ok"),
      cost: tracer.totals.cost,
      tokens: tracer.totals.input + tracer.totals.output,
    };
  } catch (err) {
    return { ok: false, ms: Date.now() - started, error: err.message, cost: tracer.totals.cost };
  }
}

// --------------------------------------------------------------------- main

const wanted = process.argv[2];
const models = Object.keys(MODELS).filter((m) => (wanted ? m === wanted : true));
if (!models.length) {
  console.error(`Unknown model "${wanted}". Known: ${Object.keys(MODELS).join(", ")}`);
  process.exit(1);
}

const hasKey = (provider) => {
  if (provider !== "google") return false;
  return (
    (process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? "").length > 10 ||
    (process.env.GOOGLE_API_KEY ?? "").length > 10
  );
};

const pairs = [];
for (const model of models) {
  const provider = modelInfo(model).provider;
  if (!hasKey(provider)) {
    console.log(`skip ${model} — no ${provider} API key configured\n`);
    continue;
  }
  for (const engine of ENGINE_IDS) if (engineSupports(engine, provider)) pairs.push({ model, engine });
}

if (!pairs.length) {
  console.error("Nothing to run: no API key for any requested model.");
  process.exit(1);
}

const totals = [];
for (const { model, engine } of pairs) {
  console.log(`\n${"=".repeat(72)}\n${model}  ·  ${engine}\n${"=".repeat(72)}`);
  let cost = 0;
  let fails = 0;
  for (const example of EXAMPLES) {
    const r = await runOne({ model, engine, example });
    cost += r.cost ?? 0;
    console.log(`\n▸ ${example.id}  «${example.text}»`);
    console.log(`  want: ${example.expect}`);
    if (!r.ok) {
      fails++;
      console.log(`  FAILED: ${r.error}`);
      continue;
    }
    console.log(`  tools: ${r.tools.join(" → ") || "none"}${r.escalated ? "  [ESCALATED]" : ""}`);
    console.log(`  ${r.ms}ms · ${r.tokens} tok · $${r.cost.toFixed(6)}`);
    console.log(`  reply: ${r.reply}`);
  }
  totals.push({ model, engine, cost, fails });
}

console.log(`\n${"=".repeat(72)}\nTOTALS (${EXAMPLES.length} messages)\n${"=".repeat(72)}`);
for (const t of totals) {
  console.log(
    `  ${t.model.padEnd(24)} ${t.engine.padEnd(10)} $${t.cost.toFixed(6)}` +
      `  ≈ $${(t.cost / EXAMPLES.length * 200 * 30).toFixed(2)}/mo at 200 demos/day` +
      (t.fails ? `  (${t.fails} failed)` : "")
  );
}
