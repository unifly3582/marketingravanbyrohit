// Marketing Ravan backend: call requests, Sarvam + WhatsApp webhooks,
// the Gemini agent layer, and the admin dashboard API.
import "./env.mjs"; // must precede db.mjs — ESM evaluates imports before top-level code
import express from "express";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { sb, upsertLead, recordCall, completeCall, windowOpen, clearUnread, unwrap } from "./db.mjs";
import { phone10, sendTemplate, sendText, ingest } from "./wa.mjs";
import { workflowList, workflow } from "./agent/graph.mjs";
import { runWhatsAppAgent } from "./agent/whatsapp-agent.mjs";
import { engineCatalog, defaultEngineId, engineFor, ENGINE_IDS } from "./agent/engines/index.mjs";
import { modelCatalog, modelInfo, demoModel, productionModel, MODELS } from "./agent/models.mjs";
import { embed, EMBED_DIMS, searchPlaybook } from "./agent/tools.mjs";

const dir = dirname(fileURLToPath(import.meta.url));

const env = (k, d) => process.env[k] ?? d;

const PORT = Number(env("PORT", 8787));
const PUBLIC_BASE_URL = env("PUBLIC_BASE_URL", "http://147.93.28.140:8100");
const ADMIN_PASSWORD = env("ADMIN_PASSWORD");
const AGENT_TOOL_TOKEN = env("AGENT_TOOL_TOKEN");
// Off by default: turning this on lets the agent reply to real customers unattended.
const AGENT_AUTOREPLY = env("AGENT_AUTOREPLY", "false") === "true";
const DEMO_ENABLED = env("AGENT_DEMO_ENABLED", "true") === "true";

for (const k of ["SARVAM_SAMVAAD_API_KEY", "SARVAM_ORG_ID", "SARVAM_WORKSPACE_ID", "AGENT_PHONE_NUMBER"]) {
  if (!env(k)) { console.error(`Missing env ${k}`); process.exit(1); }
}

const app = express();
app.use(express.json({ limit: "2mb" }));
app.set("trust proxy", true);

/** Wrap an async handler so a rejected promise becomes a 500, not a hang. */
const wrap = (fn) => (req, res) => fn(req, res).catch((e) => {
  console.error(req.path, e.message);
  if (!res.headersSent) res.status(500).json({ error: "Something went wrong." });
});

// ---------------- rate limiting ----------------

/** Sliding per-IP window plus a global daily cap. */
function makeLimiter({ perIpPerHour, globalPerDay, dailyMessage }) {
  const ipHits = new Map();
  let dayCount = { day: new Date().toDateString(), n: 0 };
  return (ip) => {
    const now = Date.now();
    const hits = (ipHits.get(ip) ?? []).filter((t) => now - t < 3600_000);
    if (hits.length >= perIpPerHour) return "Too many requests. Try again later.";
    const today = new Date().toDateString();
    if (dayCount.day !== today) dayCount = { day: today, n: 0 };
    if (dayCount.n >= globalPerDay) return dailyMessage;
    hits.push(now); ipHits.set(ip, hits); dayCount.n++;
    return null;
  };
}

const limitCall = makeLimiter({
  perIpPerHour: 3,
  globalPerDay: 100,
  dailyMessage: "Daily call limit reached. Please use WhatsApp or email instead.",
});

// The demo spends real model tokens for anonymous visitors — cap it tightly.
const limitDemo = makeLimiter({
  perIpPerHour: Number(env("AGENT_DEMO_PER_IP_PER_HOUR", 5)),
  globalPerDay: Number(env("AGENT_DEMO_PER_DAY", 200)),
  dailyMessage: "The live demo has hit today's limit. Book a call and we'll show you in person.",
});

// ---------------- call requests (site button) ----------------

async function dispatchCall(p10, { name, source } = {}) {
  const res = await fetch(
    `https://apps.sarvam.ai/api/outbounds/v1/orgs/${env("SARVAM_ORG_ID")}/workspaces/${env("SARVAM_WORKSPACE_ID")}/outbounds`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": env("SARVAM_SAMVAAD_API_KEY"),
        Authorization: `Bearer ${env("SARVAM_SAMVAAD_API_KEY")}`,
      },
      body: JSON.stringify({
        app_config: {
          app_id: env("SARVAM_APP_ID", "Conversatio-1b327c92-3694"),
          app_version: Number(env("SARVAM_APP_VERSION", 2)),
          connection_config: {
            connection_id: env("SARVAM_CONNECTION_ID", "8efca9cf-94-b9219a1c-5823"),
            agent_phone_number: env("AGENT_PHONE_NUMBER"),
          },
        },
        user_config: { user_phone_number: `+91${p10}` },
        webhook_config: {
          url: `${PUBLIC_BASE_URL}/api/webhooks/sarvam?token=${env("SARVAM_WEBHOOK_TOKEN", "mr-hook")}`,
          metadata: { phone10: p10 },
        },
      }),
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(JSON.stringify(data).slice(0, 300));
  if (name) await upsertLead(p10, { name });
  await recordCall(p10, data.attempt_id ?? null, source ?? "website");
  return data.attempt_id;
}

app.post("/api/request-call", wrap(async (req, res) => {
  const p10 = phone10(req.body?.phone);
  if (!p10) return res.status(400).json({ error: "Please enter a valid 10-digit Indian mobile number." });
  const msg = limitCall(req.ip);
  if (msg) return res.status(429).json({ error: msg });
  try {
    const attempt_id = await dispatchCall(p10, { name: req.body?.name, source: req.body?.source ?? "website" });
    res.json({ ok: true, attempt_id });
  } catch (e) {
    console.error("request-call", e.message);
    res.status(502).json({ error: "Could not place the call right now. Please try again in a minute." });
  }
}));

// ---------------- Sarvam webhook (call finished → transcript) ----------------

app.post("/api/webhooks/sarvam", wrap(async (req, res) => {
  if (req.query.token !== env("SARVAM_WEBHOOK_TOKEN", "mr-hook")) return res.status(403).end();
  const p = req.body ?? {};
  const p10 = p.webhook_config?.metadata?.phone10 ?? null;
  if (p.attempt_id) await completeCall(p.attempt_id, p);
  if (p10) await upsertLead(p10, { status: p.status === "connected" ? "talked" : "call_failed" });
  console.log("sarvam webhook", p.attempt_id, p.status, "dur:", p.duration);
  res.json({ ok: true });
}));

// ---------------- WhatsApp webhook (BSP panel) ----------------

// Verification handshake: echo the `challange` query param (BSP's spelling).
app.get("/api/webhooks/whatsapp", (req, res) => {
  const c = req.query.challange ?? req.query.challenge ?? "no challange";
  res.status(200).type("text/html").send(String(c));
});

app.post("/api/webhooks/whatsapp", (req, res) => {
  // Always 200 immediately so the BSP does not retry-storm; process after.
  res.json({ ok: true });
  (async () => {
    const out = await ingest(req.body ?? {});
    console.log("wa webhook", out.kind, out.count ?? "");
    if (!AGENT_AUTOREPLY) return;
    for (const m of out.inbound) {
      const r = await runWhatsAppAgent({
        phone10: m.phone10,
        text: m.text ?? `[${m.type}]`,
        contactName: m.contactName,
        trigger: "whatsapp_inbound",
      });
      console.log("agent run", r.runId, r.status);
    }
  })().catch((e) => console.error("wa webhook error", e.message));
});

// ---------------- voice-agent tool: send WhatsApp mid-call ----------------

app.post("/api/agent/whatsapp", wrap(async (req, res) => {
  if (!AGENT_TOOL_TOKEN || req.headers["x-tool-token"] !== AGENT_TOOL_TOKEN)
    return res.status(403).json({ error: "forbidden" });
  const p10 = phone10(req.body?.phone);
  if (!p10) return res.status(400).json({ error: "invalid phone" });
  try {
    if (req.body?.text && (await windowOpen(p10))) {
      const r = await sendText(p10, req.body.text, "voice-agent");
      return res.json({ ok: true, messageId: r.messageId, mode: "text" });
    }
    const r = await sendTemplate(
      p10,
      req.body?.template ?? env("WA_DEFAULT_TEMPLATE", "hi_intro"),
      req.body?.language ?? "en",
      req.body?.params ?? [],
      "voice-agent"
    );
    res.json({ ok: true, messageId: r.messageId, mode: "template" });
  } catch (e) {
    console.error("agent wa", e.message);
    res.status(502).json({ error: e.message });
  }
}));

// ---------------- public: workflow graphs + live demo ----------------

// Engine availability is probed once at boot, not per request — importing
// LangGraph and Mastra is slow enough to notice.
const enginesReady = engineCatalog().catch((e) => {
  console.error("engine catalog:", e.message);
  return [];
});

app.get("/api/workflows", wrap(async (req, res) =>
  res.json({
    workflows: workflowList(),
    engines: await enginesReady,
    defaultEngine: defaultEngineId(),
    models: modelCatalog(),
    defaultModel: demoModel(), // what the public demo will actually use
  })
));

/**
 * Anonymous visitors can run the agent against a scratch conversation. Side
 * effects are simulated; the trace is written with demo = true, which is the
 * only thing the site's anon key is allowed to read.
 */
app.post("/api/agent/demo", wrap(async (req, res) => {
  if (!DEMO_ENABLED) return res.status(404).json({ error: "demo disabled" });
  const text = String(req.body?.message ?? "").trim();
  if (!text) return res.status(400).json({ error: "Type a message first." });
  if (text.length > 500) return res.status(400).json({ error: "Keep it under 500 characters." });
  if (!workflow(req.body?.workflow ?? "whatsapp-responder"))
    return res.status(400).json({ error: "unknown workflow" });

  // Visitors may pick the orchestrator and the model — that comparison is the
  // whole point of the page — but only from the known sets.
  const model = req.body?.model ?? demoModel();
  if (!MODELS[model]) return res.status(400).json({ error: "unknown model" });
  // Default to an engine that can actually reach this model's provider.
  const engine = req.body?.engine ?? engineFor(modelInfo(model).provider);
  if (!ENGINE_IDS.includes(engine)) return res.status(400).json({ error: "unknown engine" });

  const msg = limitDemo(req.ip);
  if (msg) return res.status(429).json({ error: msg });

  // Synthetic number: demo traffic must never collide with a real lead.
  const scratch = `9${String(Date.now()).slice(-9)}`;

  // Reply as soon as the run row exists — the browser subscribes to that id and
  // watches the rest arrive over Realtime, rather than staring at a spinner.
  const runId = await new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 10_000);
    runWhatsAppAgent({
      phone10: scratch,
      text,
      contactName: "Demo visitor",
      trigger: "demo",
      demo: true,
      engine,
      model,
      onStart: (id) => { clearTimeout(timer); resolve(id); },
    }).catch((e) => { clearTimeout(timer); console.error("demo run:", e.message); resolve(null); });
  });

  if (!runId) return res.status(503).json({ error: "The demo is warming up. Try again in a moment." });
  res.status(202).json({ ok: true, runId });
}));

// ---------------- admin API ----------------

function admin(req, res, next) {
  if (!ADMIN_PASSWORD) return res.status(500).json({ error: "ADMIN_PASSWORD not configured" });
  const auth = req.headers.authorization ?? "";
  if (auth === `Bearer ${ADMIN_PASSWORD}`) return next();
  res.status(401).json({ error: "unauthorized" });
}

const countOf = async (table, build = (q) => q) =>
  (await build(sb.from(table).select("*", { count: "exact", head: true }))).count ?? 0;

app.get("/api/admin/overview", admin, wrap(async (req, res) => {
  const midnight = new Date(); midnight.setHours(0, 0, 0, 0);
  const [leads, calls, connected, conversations, callsToday, runs, runsFailed] = await Promise.all([
    countOf("leads"),
    countOf("calls"),
    countOf("calls", (q) => q.eq("status", "connected")),
    countOf("conversations"),
    countOf("calls", (q) => q.gte("created_at", midnight.toISOString())),
    countOf("agent_runs", (q) => q.eq("demo", false)),
    countOf("agent_runs", (q) => q.eq("demo", false).eq("status", "failed")),
  ]);
  const unreadRows = unwrap(await sb.from("conversations").select("unread"), "unread");
  const spend = unwrap(
    await sb.from("agent_runs").select("cost_usd").gte("created_at", midnight.toISOString()),
    "spend"
  );
  res.json({
    leads, calls, connected, conversations, calls_today: callsToday,
    unread: unreadRows.reduce((n, r) => n + (r.unread ?? 0), 0),
    agent_runs: runs,
    agent_failures: runsFailed,
    agent_spend_today: Number(spend.reduce((n, r) => n + Number(r.cost_usd ?? 0), 0).toFixed(4)),
  });
}));

app.get("/api/admin/calls", admin, wrap(async (req, res) => {
  res.json(unwrap(
    await sb.from("calls")
      .select("id, attempt_id, phone10, status, duration, created_at, completed_at, transcript, leads(name)")
      .order("created_at", { ascending: false }).limit(200),
    "calls"
  ).map(({ transcript, leads, ...row }) => ({
    ...row, name: leads?.name ?? null, has_transcript: transcript != null,
  })));
}));

app.get("/api/admin/calls/:id", admin, wrap(async (req, res) => {
  const row = unwrap(await sb.from("calls").select("*").eq("id", req.params.id).maybeSingle(), "call");
  if (!row) return res.status(404).json({ error: "not found" });
  res.json(row);
}));

app.get("/api/admin/conversations", admin, wrap(async (req, res) => {
  res.json(unwrap(
    await sb.from("conversations").select("*")
      .order("last_message_at", { ascending: false, nullsFirst: false }).limit(200),
    "conversations"
  ));
}));

app.get("/api/admin/messages", admin, wrap(async (req, res) => {
  const p10 = phone10(req.query.phone);
  if (!p10) return res.status(400).json({ error: "invalid phone" });
  await clearUnread(p10);
  const conv = unwrap(
    await sb.from("conversations").select("id").eq("phone10", p10).maybeSingle(),
    "conversation"
  );
  if (!conv) return res.json([]);
  res.json(unwrap(
    await sb.from("messages").select("*").eq("conversation_id", conv.id)
      .order("created_at", { ascending: true }).limit(500),
    "messages"
  ));
}));

app.post("/api/admin/send", admin, wrap(async (req, res) => {
  const p10 = phone10(req.body?.phone);
  if (!p10) return res.status(400).json({ error: "invalid phone" });
  try {
    if (req.body?.template) {
      const r = await sendTemplate(p10, req.body.template, req.body.language ?? "en", req.body.params ?? []);
      return res.json({ ok: true, messageId: r.messageId });
    }
    if (!(await windowOpen(p10)))
      return res.status(409).json({ error: "24-hour window closed — send an approved template instead." });
    const r = await sendText(p10, String(req.body?.text ?? "").trim());
    res.json({ ok: true, messageId: r.messageId });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
}));

app.post("/api/admin/call", admin, wrap(async (req, res) => {
  const p10 = phone10(req.body?.phone);
  if (!p10) return res.status(400).json({ error: "invalid phone" });
  try {
    const attempt_id = await dispatchCall(p10, { source: "dashboard" });
    res.json({ ok: true, attempt_id });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
}));

/** Run the agent against a real conversation, on demand, from the dashboard. */
app.post("/api/admin/agent/run", admin, wrap(async (req, res) => {
  const p10 = phone10(req.body?.phone);
  if (!p10) return res.status(400).json({ error: "invalid phone" });
  const text = String(req.body?.text ?? "").trim();
  if (!text) return res.status(400).json({ error: "text required" });
  const model = req.body?.model ?? productionModel();
  if (!MODELS[model]) return res.status(400).json({ error: "unknown model" });
  const engine = req.body?.engine ?? engineFor(modelInfo(model).provider);
  if (!ENGINE_IDS.includes(engine)) return res.status(400).json({ error: "unknown engine" });
  const r = await runWhatsAppAgent({ phone10: p10, text, trigger: "manual", engine, model });
  res.json(r);
}));

app.get("/api/admin/agent/runs", admin, wrap(async (req, res) => {
  res.json(unwrap(
    await sb.from("agent_runs").select("*").order("created_at", { ascending: false }).limit(100),
    "agent_runs"
  ));
}));

app.get("/api/admin/agent/runs/:id", admin, wrap(async (req, res) => {
  const run = unwrap(await sb.from("agent_runs").select("*").eq("id", req.params.id).maybeSingle(), "run");
  if (!run) return res.status(404).json({ error: "not found" });
  const steps = unwrap(
    await sb.from("agent_steps").select("*").eq("run_id", run.id).order("seq"),
    "steps"
  );
  res.json({ ...run, steps });
}));

// ---------------- playbook ----------------
//
// The agent quotes these rules verbatim, so this is the most safety-relevant
// screen in the dashboard: a wrong number here is a wrong number in front of a
// customer. Every write re-embeds, because a rule whose text and vector
// disagree is retrievable by the old wording and answers with the new one.

app.get("/api/admin/playbook", admin, wrap(async (req, res) => {
  const rows = unwrap(
    await sb.from("policies").select("id, title, rule, category, active, updated_at, embedding")
      .order("category").order("title"),
    "playbook"
  );
  // The vector is ~1024 floats; send only whether it exists.
  res.json(rows.map(({ embedding, ...r }) => ({ ...r, embedded: embedding != null })));
}));

app.post("/api/admin/playbook", admin, wrap(async (req, res) => {
  const { id, title, rule, category, active } = req.body ?? {};
  if (!title?.trim() || !rule?.trim())
    return res.status(400).json({ error: "title and rule are required" });

  const row = {
    title: title.trim(),
    rule: rule.trim(),
    category: (category ?? "general").trim(),
    active: active !== false,
  };

  // Embed before writing: if embedding fails, leave the old rule intact rather
  // than storing text the agent cannot retrieve.
  const vector = await embed(`${row.title}\n${row.rule}`, "document");
  if (vector) {
    if (vector.length !== EMBED_DIMS)
      return res.status(500).json({ error: `embedding returned ${vector.length} dims, expected ${EMBED_DIMS}` });
    row.embedding = vector;
  }

  const saved = id
    ? unwrap(await sb.from("policies").update(row).eq("id", id).select().maybeSingle(), "update rule")
    : unwrap(await sb.from("policies").insert(row).select().maybeSingle(), "insert rule");

  res.json({ ok: true, id: saved?.id ?? id, embedded: !!vector });
}));

app.delete("/api/admin/playbook/:id", admin, wrap(async (req, res) => {
  unwrap(await sb.from("policies").delete().eq("id", req.params.id), "delete rule");
  res.json({ ok: true });
}));

/** Try a query the way the agent would, to see what it would actually find. */
app.post("/api/admin/playbook/search", admin, wrap(async (req, res) => {
  const query = String(req.body?.query ?? "").trim();
  if (!query) return res.status(400).json({ error: "query required" });
  const result = await searchPlaybook(query);
  res.json(result);
}));

app.get("/api/admin/offers", admin, wrap(async (req, res) => {
  res.json(unwrap(await sb.from("offers").select("*").order("created_at", { ascending: false }), "offers"));
}));

app.post("/api/admin/offers", admin, wrap(async (req, res) => {
  const { id, name, pitch, goal, active } = req.body ?? {};
  if (!name || !pitch) return res.status(400).json({ error: "name and pitch required" });
  // Only one offer is live at a time.
  if (active) unwrap(await sb.from("offers").update({ active: false }).eq("active", true), "clear active");
  const row = { name, pitch, goal: goal ?? null, active: !!active };
  if (id) unwrap(await sb.from("offers").update(row).eq("id", id), "update offer");
  else unwrap(await sb.from("offers").insert(row), "insert offer");
  res.json({ ok: true });
}));

// ---------------- dashboard page ----------------

app.get(["/admin", "/admin/"], (req, res) => res.sendFile(join(dir, "public", "admin.html")));

app.listen(PORT, () => {
  console.log(`marketingravan server listening on :${PORT}`);
  console.log(`  agent auto-reply: ${AGENT_AUTOREPLY ? "ON" : "off"}   public demo: ${DEMO_ENABLED ? "on" : "off"}`);
  console.log(`  production: ${productionModel()} via ${defaultEngineId()}`);
  console.log(`  demo:       ${demoModel()} via ${engineFor(modelInfo(demoModel())?.provider ?? "google")}`);
});
