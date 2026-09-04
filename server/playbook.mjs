// Playbook ingestion.
//
//   node playbook.mjs seed      # write the starter playbook (skips existing titles)
//   node playbook.mjs embed     # embed any rows missing a vector
//   node playbook.mjs list      # what is in there
//   node playbook.mjs search "how much is a website"   # test retrieval
//
// The `policies` table is what stops the agent inventing prices. Every factual
// claim it makes is supposed to come from here via search_playbook, so an empty
// table means an agent with nothing to stand on.
//
// Embeddings are 1024-dim from gemini-embedding-001, matching the column.

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

const { sb } = await import("./db.mjs");
const { embed, EMBED_MODEL, EMBED_DIMS } = await import("./agent/tools.mjs");

/**
 * Starter playbook. Placeholder commercials — replace with the real numbers
 * before this answers a paying customer. Everything here is quotable by the
 * agent verbatim, so anything wrong here is wrong in front of a client.
 */
const SEED = [
  { category: "pricing", title: "Website pricing",
    rule: "A 5-page mobile-first website starts at ₹45,000 and ships in 3 weeks. E-commerce builds start at ₹1,20,000 and take 5-6 weeks. Prices exclude domain, hosting and paid stock." },
  { category: "pricing", title: "Social and WhatsApp retainer",
    rule: "Social media plus WhatsApp automation retainer is ₹35,000 per month with a 3-month minimum. Includes 12 posts a month, WhatsApp agent setup, and a monthly performance review." },
  { category: "pricing", title: "AI agent build",
    rule: "A custom AI agent (WhatsApp, voice, or both) starts at ₹75,000 setup plus ₹15,000 per month for hosting, monitoring and prompt tuning. Voice agents in Indian languages are included." },
  { category: "pricing", title: "Discounts and negotiation",
    rule: "Never offer a discount. If a customer pushes on price, offer a smaller starting scope instead, and say a human will confirm any custom pricing." },

  { category: "delivery", title: "Timelines",
    rule: "Websites 3 weeks, e-commerce 5-6 weeks, AI agents 2 weeks to first working version. Timelines start once content and access are received, not at payment." },
  { category: "delivery", title: "What we need from the client",
    rule: "To start we need: brand assets, content or approval to write it, and access to the relevant accounts (Meta Business, domain registrar, WhatsApp number)." },

  { category: "policy", title: "Refunds",
    rule: "No refunds once work has begun. The advance covers scoping and design time. Any refund request, chargeback or payment dispute must go to a human within one business day — never promise, agree to, or estimate a refund." },
  { category: "policy", title: "Escalation triggers",
    rule: "Hand to a human immediately if: the customer asks for a person, raises a legal or payment dispute, is angry, asks for a discount or custom pricing, or asks something the playbook does not cover." },
  { category: "policy", title: "Data and privacy",
    rule: "Customer data stays in the client's own systems. We do not sell, share or reuse customer lists. If asked about data handling in detail, escalate to a human rather than improvising." },

  { category: "general", title: "Languages",
    rule: "We work in English, Hindi and Marathi. Voice agents also support Tamil, Telugu, Kannada, Bengali and Gujarati. Always reply in the language and script the customer used." },
  { category: "general", title: "What Marketing Ravan does",
    rule: "We build AI agents and marketing systems for Indian businesses: WhatsApp sales agents, voice agents that call leads, websites, and social media. Ten specialist 'heads', one growth engine." },
  { category: "general", title: "Working hours and response time",
    rule: "The AI agent answers 24/7. A human replies within one business hour, 10am-7pm IST Monday to Saturday." },
];

const text = (p) => `${p.title}\n${p.rule}`;

async function seed() {
  const existing = new Set(
    ((await sb.from("policies").select("title")).data ?? []).map((r) => r.title)
  );
  const fresh = SEED.filter((p) => !existing.has(p.title));
  if (!fresh.length) return console.log(`nothing to seed — all ${SEED.length} titles already present`);
  const { error } = await sb.from("policies").insert(fresh.map((p) => ({ ...p, active: true })));
  if (error) throw new Error(error.message);
  console.log(`seeded ${fresh.length} rules (${existing.size} already existed)`);
}

async function embedMissing() {
  const { data, error } = await sb
    .from("policies")
    .select("id, title, rule")
    .is("embedding", null);
  if (error) throw new Error(error.message);
  if (!data.length) return console.log("every rule already has an embedding");

  console.log(`embedding ${data.length} rules with ${EMBED_MODEL} (${EMBED_DIMS} dims)…`);
  let done = 0;
  for (const row of data) {
    const vector = await embed(text(row), "document");
    if (!vector) throw new Error("no embedding provider configured — set GOOGLE_GENERATIVE_AI_API_KEY");
    if (vector.length !== EMBED_DIMS) {
      throw new Error(`got ${vector.length} dims, column expects ${EMBED_DIMS}`);
    }
    const up = await sb.from("policies").update({ embedding: vector }).eq("id", row.id);
    if (up.error) throw new Error(`${row.title}: ${up.error.message}`);
    console.log(`  ✓ ${row.title}`);
    done++;
  }
  console.log(`embedded ${done}`);
}

async function list() {
  const { data, error } = await sb
    .from("policies")
    .select("title, category, active, embedding")
    .order("category");
  if (error) throw new Error(error.message);
  console.log(`${data.length} rules:`);
  for (const p of data) {
    console.log(
      `  ${p.active ? "●" : "○"} ${p.embedding ? "vec" : "———"}  ${p.category.padEnd(9)} ${p.title}`
    );
  }
}

async function search(query) {
  const vector = await embed(query, "query");
  if (!vector) throw new Error("no embedding provider configured");
  const { data, error } = await sb.rpc("match_policies", {
    query_embedding: vector,
    match_count: 5,
    similarity_threshold: 0.25,
  });
  if (error) throw new Error(error.message);
  console.log(`"${query}" →`);
  if (!data.length) return console.log("  (no matches above threshold)");
  for (const r of data) {
    console.log(`  ${r.similarity.toFixed(3)}  [${r.category}] ${r.title}`);
    console.log(`         ${r.rule.slice(0, 110)}${r.rule.length > 110 ? "…" : ""}`);
  }
}

const [cmd, ...rest] = process.argv.slice(2);
try {
  if (cmd === "seed") await seed();
  else if (cmd === "embed") await embedMissing();
  else if (cmd === "list") await list();
  else if (cmd === "search") await search(rest.join(" ") || "pricing");
  else {
    console.log("usage: node playbook.mjs seed|embed|list|search <query>");
    process.exit(1);
  }
} catch (err) {
  console.error("failed:", err.message);
  process.exit(1);
}
