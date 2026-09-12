// Marketing Ravan backend: call requests, Sarvam + WhatsApp webhooks,
// the Gemini agent layer, and the admin dashboard API.
import "./env.mjs"; // must precede db.mjs — ESM evaluates imports before top-level code
import express from "express";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import {
  sb, upsertLead, recordCall, completeCall, windowOpen, clearUnread, unwrap,
  conversationByPhone, setConversationMode, flagHandoff, resolveHandoff, insertMessage, touchConversation,
  setConversationSource, messagesSince,
} from "./db.mjs";
import { phone10, sendTemplate, sendText, ingest, listTemplates, sendHandoff, sendDemoIntro, HANDOFF_TEMPLATE } from "./wa.mjs";
import { sessionsByRun } from "./voice/web-session.mjs";
import { workflowList, workflow } from "./agent/graph.mjs";
import { runWhatsAppAgent } from "./agent/whatsapp-agent.mjs";
import { engineCatalog, defaultEngineId, engineFor, ENGINE_IDS } from "./agent/engines/index.mjs";
import { modelCatalog, modelInfo, demoModel, productionModel, MODELS } from "./agent/models.mjs";
import { embed, EMBED_DIMS, searchPlaybook } from "./agent/tools.mjs";
import * as voice from "./voice/index.mjs";

const dir = dirname(fileURLToPath(import.meta.url));

const env = (k, d) => process.env[k] ?? d;

const PORT = Number(env("PORT", 8787));
const PUBLIC_BASE_URL = env("PUBLIC_BASE_URL", "http://147.93.28.140:8100");
const ADMIN_PASSWORD = env("ADMIN_PASSWORD");
const AGENT_TOOL_TOKEN = env("AGENT_TOOL_TOKEN");
// The WhatsApp agent answers inbound messages on its own. On by default since
// 2026-09-05: the website hands conversations to WhatsApp expecting someone to
// pick them up, and "someone" is the agent until a person takes the thread
// over from the dashboard (conversations.mode = 'human'). Set to "false" to
// silence it everywhere at once.
const AGENT_AUTOREPLY = env("AGENT_AUTOREPLY", "true") !== "false";
const DEMO_ENABLED = env("AGENT_DEMO_ENABLED", "true") === "true";

// SARVAM_ORG_ID/SARVAM_WORKSPACE_ID/SARVAM_SAMVAAD_API_KEY are for the old
// Conversatio dial path (dispatchCall/webhooks/sarvam below) — kept dormant
// as a fallback, not deleted, while the Vobiz+Gemini pipeline is unproven.
for (const k of ["SARVAM_SAMVAAD_API_KEY", "SARVAM_ORG_ID", "SARVAM_WORKSPACE_ID", "AGENT_PHONE_NUMBER"]) {
  if (!env(k)) { console.error(`Missing env ${k}`); process.exit(1); }
}
// VOBIZ_AUTH_ID/VOBIZ_AUTH_TOKEN are NOT required at boot: the user doesn't
// have them yet, and WhatsApp/admin/playbook must keep working regardless of
// whether outbound dialing is configured. voice/vobiz.mjs's dialOut() throws
// a clear error at call time instead — /api/request-call and /api/admin/call
// already turn that into a normal 502, not a crashed server.

const app = express();
app.use(express.json({ limit: "2mb" }));
app.set("trust proxy", true);
const httpServer = createServer(app);

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
// The handoff form sends a real WhatsApp template per submit.
const limitHandoff = makeLimiter({
  perIpPerHour: Number(env("HANDOFF_PER_IP_PER_HOUR", 5)),
  globalPerDay: Number(env("HANDOFF_PER_DAY", 300)),
  dailyMessage: "We cannot take more WhatsApp requests today. Message us directly instead.",
});

// A live WhatsApp demo sends a real template to whatever number was typed in.
const limitWaDemo = makeLimiter({
  perIpPerHour: Number(env("WA_DEMO_PER_IP_PER_HOUR", 3)),
  globalPerDay: Number(env("WA_DEMO_PER_DAY", 200)),
  dailyMessage: "We cannot start more WhatsApp demos today. Message us directly instead.",
});

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
    const attempt_id = await voice.dialOut(p10, { name: req.body?.name, source: req.body?.source ?? "website" });
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
//
// Same handshake the Buggly Farms OMS uses with this BSP (crm.marketingravan.com):
//
//   1. In the BSP panel you paste the webhook URL. The panel immediately sends
//      GET <url>?challange=<random>  (their spelling) and expects the bare value
//      echoed back with HTTP 200 as text — anything else and it refuses to save.
//   2. From then on it POSTs Meta's native envelope for every inbound message,
//      button tap, delivery status, and (Coexistence) echoes of messages sent
//      from the WhatsApp Business app on the same number.
//
// Meta's own `hub.challenge` handshake is accepted too, so the same URL works
// if the number is ever pointed straight at the Cloud API.
//
// Optional shared secret: set WA_WEBHOOK_TOKEN and put ?token=<value> on the URL
// you register. Without it the endpoint stays open, like the OMS.

const WA_WEBHOOK_TOKEN = env("WA_WEBHOOK_TOKEN");
const WA_WEBHOOK_PATH = "/api/webhooks/whatsapp";

/** The exact URL to paste into the BSP panel. */
function whatsappWebhookUrl() {
  const base = env("WA_WEBHOOK_PUBLIC_URL", PUBLIC_BASE_URL).replace(/\/+$/, "");
  return `${base}${WA_WEBHOOK_PATH}${WA_WEBHOOK_TOKEN ? `?token=${encodeURIComponent(WA_WEBHOOK_TOKEN)}` : ""}`;
}

function webhookTokenOk(req) {
  if (!WA_WEBHOOK_TOKEN) return true;
  const provided = req.query.token ?? req.query["hub.verify_token"] ?? req.headers["x-webhook-token"];
  return provided === WA_WEBHOOK_TOKEN;
}

// Verification handshake.
app.get(WA_WEBHOOK_PATH, (req, res) => {
  const challenge = req.query.challange ?? req.query.challenge ?? req.query["hub.challenge"];
  if (!webhookTokenOk(req)) {
    console.warn("wa webhook verify rejected: bad token from", req.ip);
    return res.status(403).type("text/plain").send("forbidden");
  }
  console.log("wa webhook verify", challenge != null ? "ok" : "(no challenge param)", "from", req.ip);
  res.status(200).type("text/html").send(String(challenge ?? "no challange"));
});

// The BSP does not promise JSON: accept form-encoded and raw text bodies too,
// and turn a JSON string hidden in a form field back into an object.
const webhookBody = [
  express.urlencoded({ extended: true, limit: "2mb" }),
  express.text({ type: () => true, limit: "2mb" }),
  (req, res, next) => {
    let b = req.body;
    if (typeof b === "string") { try { b = JSON.parse(b); } catch { b = { raw: b }; } }
    else if (b && typeof b === "object") {
      for (const [k, v] of Object.entries(b)) {
        if (typeof v === "string" && /^[\[{]/.test(v)) { try { b[k] = JSON.parse(v); } catch { /* keep */ } }
      }
    }
    req.body = b ?? {};
    next();
  },
];

app.post(WA_WEBHOOK_PATH, ...webhookBody, (req, res) => {
  if (!webhookTokenOk(req)) {
    console.warn("wa webhook event rejected: bad token from", req.ip);
    return res.status(401).json({ error: "unauthorized" });
  }
  // Always 200 immediately so the BSP does not retry-storm; process after.
  res.json({ ok: true });
  (async () => {
    const out = await ingest(req.body ?? {});
    console.log("wa webhook", out.kind, out.count ?? "");
    if (!AGENT_AUTOREPLY) return;
    for (const m of out.inbound) {
      // A person who took the thread over from the dashboard owns it until
      // they hand it back; the agent must not talk over them.
      const conv = await conversationByPhone(m.phone10).catch(() => null);
      if (conv?.mode === "human") {
        console.log("agent skipped (human mode)", m.phone10);
        continue;
      }
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

// ---------------- website → WhatsApp handoff ----------------
//
// The voice panel opens a small form when the agent escalates, when the
// microphone or the connection fails, or when the visitor simply asks to
// continue on WhatsApp. Submitting it does four things: creates the lead,
// attaches the voice transcript to their thread, flags the thread for a
// person, and sends the approved handoff template — which asks them to reply,
// because a reply is what opens WhatsApp's 24-hour window and lets the agent
// (or a person) answer in free text after that.

/** Handoff tokens → what the panel may poll about, so it never needs the phone number. */
const handoffs = new Map();
const HANDOFF_TOKEN_TTL_MS = 6 * 60 * 60 * 1000;
setInterval(() => {
  const cutoff = Date.now() - HANDOFF_TOKEN_TTL_MS;
  for (const [k, v] of handoffs) if (v.at < cutoff) handoffs.delete(k);
}, 15 * 60 * 1000).unref();

const WA_BUSINESS_PHONE = () => String(env("WA_BUSINESS_PHONE", "")).replace(/\D/g, "");
/** A click-to-chat link with the opening line written for them. */
function waLink(name, note) {
  const who = name ? `I'm ${name}. ` : "";
  const about = note ? ` about ${note}` : "";
  const text = `Hi, ${who}I was talking to Ravan on your website${about}. Can we continue here?`;
  return `https://wa.me/${WA_BUSINESS_PHONE()}?text=${encodeURIComponent(text)}`;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Write a finished voice session's transcript onto a thread. A live session
 * does this itself when it ends; this is for a form submitted after the
 * session already closed (mic denied, connection dropped, quota refused).
 */
async function attachRunTranscript(runId, p10) {
  const run = unwrap(
    await sb.from("agent_runs").select("id, workflow, output").eq("id", runId).maybeSingle(),
    "handoff run"
  );
  if (!run || run.workflow !== "web-voice") return 0;
  // The session already wrote it to this number's thread.
  if (run.output?.lead?.phone10 === p10) return 0;
  const turns = Array.isArray(run.output?.transcript) ? run.output.transcript : [];
  for (const t of turns) {
    await insertMessage(p10, {
      direction: t.role === "user" ? "in" : "out",
      type: "voice",
      text: t.text,
      source: "web-voice",
      timestamp: t.at,
    }).catch(() => {});
  }
  await sb.from("agent_runs").update({ phone10: p10 }).eq("id", runId);
  return turns.length;
}

app.post("/api/handoff", wrap(async (req, res) => {
  const denied = limitHandoff(req.ip);
  if (denied) return res.status(429).json({ error: denied });
  const p10 = phone10(req.body?.phone);
  if (!p10) return res.status(400).json({ error: "Enter a 10-digit Indian mobile number." });
  const name = String(req.body?.name ?? "").trim().slice(0, 80) || null;
  const note = String(req.body?.note ?? "").trim().replace(/\s+/g, " ").slice(0, 400) || null;
  const reason = String(req.body?.reason ?? "Visitor asked to continue on WhatsApp").trim().slice(0, 200);
  const page = String(req.body?.page ?? "").slice(0, 120) || null;
  const runId = UUID_RE.test(String(req.body?.runId ?? "")) ? req.body.runId : null;

  await upsertLead(p10, { name, source: "web-voice", status: "new" });

  // Transcript: a live session adopts the identity and writes it on close;
  // an ended one is read back from its run.
  const session = runId ? sessionsByRun.get(runId) : null;
  let transcriptTurns = 0;
  if (session) session.adoptHandoff({ phone10: p10, name, note });
  else if (runId) transcriptTurns = await attachRunTranscript(runId, p10).catch((e) => { console.error("handoff transcript", e.message); return 0; });

  await flagHandoff(p10, { reason, note, runId, source: "web-voice", contactName: name });
  if (note) {
    await insertMessage(p10, { direction: "in", type: "text", text: note, source: "web-form" }).catch(() => {});
    await touchConversation(p10, { text: note, direction: "in", contactName: name, openWindow: false, bumpUnread: true }).catch(() => {});
  }

  // The template, with the visitor's own words in it. If it is not approved
  // yet (or the send fails) fall back to the plain intro template so the
  // thread still exists on their phone.
  let sent = null, sendError = null;
  try {
    sent = await sendHandoff(p10, {
      name,
      summary: note ? `You asked on our website to continue on WhatsApp about: ${note}.` : "You asked on our website to continue on WhatsApp.",
      source: "web-voice",
    });
  } catch (e) {
    sendError = e.message;
    console.error("handoff template", HANDOFF_TEMPLATE.name, e.message);
    try { sent = await sendTemplate(p10, env("WA_DEFAULT_TEMPLATE", "marketing"), "en", [], "web-voice"); }
    catch (e2) { console.error("handoff fallback template", e2.message); }
  }

  const token = randomUUID();
  handoffs.set(token, { p10, messageId: sent?.messageId ?? null, at: Date.now() });
  console.log(`handoff ${p10} (${name ?? "no name"}) from ${page ?? "?"}: ${reason}${session ? " [live session]" : transcriptTurns ? ` [${transcriptTurns} turns attached]` : ""}${sent ? "" : " — template NOT sent"}`);
  res.json({
    ok: true,
    token,
    sent: !!sent,
    text: sent?.text ?? null,
    error: sent ? null : sendError,
    waLink: waLink(name, note),
  });
}));

/** What the panel shows after the form: did it deliver, did they reply, is a person on it. */
app.get("/api/handoff/:token", wrap(async (req, res) => {
  const h = handoffs.get(req.params.token);
  if (!h) return res.status(404).json({ error: "unknown" });
  const [msg, conv] = await Promise.all([
    h.messageId
      ? sb.from("messages").select("status").eq("wa_message_id", h.messageId).maybeSingle().then((r) => r.data)
      : null,
    conversationByPhone(h.p10).catch(() => null),
  ]);
  const replied = !!(conv?.window_open_until && new Date(conv.window_open_until).getTime() > h.at);
  res.json({
    status: msg?.status ?? (h.messageId ? "sent" : "not_sent"),
    replied,
    mode: conv?.mode ?? "ai",
    human: conv?.mode === "human",
  });
}));

// ---------------- website → live WhatsApp demo ----------------
//
// "Show me the WhatsApp agent" on the website, done for real: the visitor
// types their number, the demo template lands on their phone, they reply to
// it from WhatsApp, and the same WhatsApp agent that serves clients answers
// them. The panel on the site mirrors the thread as it happens, read-only —
// the conversation belongs on their phone; the website only watches.
//
// The mirror is deliberately narrow. It shows nothing from before the demo
// was requested, the token expires, and the request is rate-limited, because
// a number typed into a public form is not proof of who is typing.

/** Demo tokens → what the panel may poll about, so it never needs the phone number. */
const demos = new Map();
const DEMO_TOKEN_TTL_MS = 60 * 60 * 1000;

function pruneDemos() {
  const cutoff = Date.now() - DEMO_TOKEN_TTL_MS;
  for (const [token, d] of demos) if (d.at < cutoff) demos.delete(token);
}

app.post("/api/demo/whatsapp", wrap(async (req, res) => {
  const denied = limitWaDemo(req.ip);
  if (denied) return res.status(429).json({ error: denied });
  const p10 = phone10(req.body?.phone);
  if (!p10) return res.status(400).json({ error: "Enter a 10-digit Indian mobile number." });
  const name = String(req.body?.name ?? "").trim().slice(0, 80) || null;
  const page = String(req.body?.page ?? "").slice(0, 120) || null;
  const device = req.body?.device === "mobile" ? "mobile" : "desktop";
  const startedAt = new Date();

  // The lead first: whoever asked for a demo is someone to follow up with,
  // whether or not the template goes through.
  await upsertLead(p10, { name, source: "web-demo", status: "new" });
  await setConversationSource(p10, "web-demo", name).catch((e) => console.error("demo source", e.message));
  const note = `Requested a live WhatsApp demo from the website${page ? ` (${page})` : ""}, on ${device}.`;
  await insertMessage(p10, { direction: "in", type: "text", text: note, source: "web-form" }).catch(() => {});
  await touchConversation(p10, { text: note, direction: "in", contactName: name, openWindow: false, bumpUnread: true }).catch(() => {});

  let sent = null, sendError = null;
  try {
    sent = await sendDemoIntro(p10, { name, source: "web-demo" });
  } catch (e) {
    sendError = e.message;
    console.error("demo template", e.message);
  }

  pruneDemos();
  const token = randomUUID();
  demos.set(token, { p10, at: startedAt.getTime(), since: startedAt.toISOString(), messageId: sent?.messageId ?? null });
  console.log(`wa demo ${p10} (${name ?? "no name"}) from ${page ?? "?"} on ${device}${sent ? ` via ${sent.template}` : " — template NOT sent"}`);
  res.json({
    ok: true,
    token,
    sent: !!sent,
    text: sent?.text ?? null,
    error: sent ? null : sendError,
    waLink: waLink(name, "the WhatsApp agent demo"),
  });
}));

/** The thread since the demo started, for the read-only mirror in the panel. */
app.get("/api/demo/whatsapp/:token", wrap(async (req, res) => {
  pruneDemos();
  const d = demos.get(req.params.token);
  if (!d) return res.status(404).json({ error: "expired" });
  const [rows, conv] = await Promise.all([
    messagesSince(d.p10, d.since).catch(() => []),
    conversationByPhone(d.p10).catch(() => null),
  ]);
  const messages = rows
    .filter((m) => m.source !== "web-form")
    .map((m) => ({
      id: m.id,
      direction: m.direction,
      text: m.body ?? (m.type && m.type !== "text" ? `[${m.type}]` : ""),
      status: m.status ?? null,
      at: m.created_at,
    }));
  const replied = messages.some((m) => m.direction === "in");
  res.json({
    messages,
    replied,
    mode: conv?.mode ?? "ai",
    human: conv?.mode === "human",
    status: messages.find((m) => m.direction === "out")?.status ?? (d.messageId ? "sent" : "not_sent"),
  });
}));

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
  const needsHuman = await countOf("conversations", (q) => q.eq("human_handoff", true));
  const unreadRows = unwrap(await sb.from("conversations").select("unread"), "unread");
  const spend = unwrap(
    await sb.from("agent_runs").select("cost_usd").gte("created_at", midnight.toISOString()),
    "spend"
  );
  res.json({
    leads, calls, connected, conversations, calls_today: callsToday,
    unread: unreadRows.reduce((n, r) => n + (r.unread ?? 0), 0),
    needs_human: needsHuman,
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

/** Shape a messages row the way the dashboard renders it. */
const messageView = (m) => ({
  id: m.id,
  direction: m.direction,
  type: m.type ?? "text",
  text: m.body ?? null,
  caption: m.caption ?? null,
  media_id: m.media_id ?? null,
  mime_type: m.mime_type ?? null,
  filename: m.filename ?? null,
  button_payload: m.button_payload ?? null,
  status: m.status ?? null,
  source: m.source ?? null,
  wa_message_id: m.wa_message_id ?? null,
  timestamp: m.wa_timestamp ?? m.created_at,
});

app.get("/api/admin/messages", admin, wrap(async (req, res) => {
  const p10 = phone10(req.query.phone);
  if (!p10) return res.status(400).json({ error: "invalid phone" });
  await clearUnread(p10);
  const conv = unwrap(
    await sb.from("conversations").select("*").eq("phone10", p10).maybeSingle(),
    "conversation"
  );
  if (!conv) return res.json({ conversation: null, messages: [] });
  const rows = unwrap(
    await sb.from("messages").select("*").eq("conversation_id", conv.id)
      .order("wa_timestamp", { ascending: true }).order("created_at", { ascending: true }).limit(500),
    "messages"
  );
  res.json({
    conversation: {
      ...conv,
      window_open: !!(conv.window_open_until && new Date(conv.window_open_until).getTime() > Date.now()),
    },
    messages: rows.map(messageView),
  });
}));

/** Raw webhook deliveries, newest first — the fastest way to see whether the BSP is reaching us. */
app.get("/api/admin/webhook", admin, wrap(async (req, res) => {
  const events = unwrap(
    await sb.from("wa_events_raw").select("id, kind, created_at, payload")
      .order("id", { ascending: false }).limit(Number(req.query.limit ?? 50)),
    "wa_events_raw"
  );
  res.json({
    url: whatsappWebhookUrl(),
    token_required: !!WA_WEBHOOK_TOKEN,
    autoreply: AGENT_AUTOREPLY,
    events,
  });
}));

app.get("/api/admin/templates", admin, wrap(async (req, res) => {
  try { res.json(await listTemplates()); }
  catch (e) { res.status(502).json({ error: e.message }); }
}));

app.post("/api/admin/send", admin, wrap(async (req, res) => {
  const p10 = phone10(req.body?.phone);
  if (!p10) return res.status(400).json({ error: "invalid phone" });
  try {
    let r;
    if (req.body?.template) {
      r = await sendTemplate(p10, req.body.template, req.body.language ?? "en", req.body.params ?? []);
    } else {
      if (!(await windowOpen(p10)))
        return res.status(409).json({ error: "24-hour window closed — send an approved template instead." });
      r = await sendText(p10, String(req.body?.text ?? "").trim());
    }
    // A person typing in the thread is a person taking it over: the agent
    // steps back until the dashboard hands the thread back.
    const conv = await setConversationMode(p10, "human").catch(() => null);
    res.json({ ok: true, messageId: r.messageId, mode: conv?.mode ?? "human" });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
}));

/** Who answers this thread: the agent, or a person. */
app.post("/api/admin/conversations/mode", admin, wrap(async (req, res) => {
  const p10 = phone10(req.body?.phone);
  if (!p10) return res.status(400).json({ error: "invalid phone" });
  const mode = req.body?.mode === "human" ? "human" : "ai";
  const conv = await setConversationMode(p10, mode);
  if (!conv) return res.status(404).json({ error: "no such conversation" });
  res.json({ ok: true, mode: conv.mode });
}));

/** Clear the needs-a-person flag once someone has dealt with it. */
app.post("/api/admin/conversations/resolve", admin, wrap(async (req, res) => {
  const p10 = phone10(req.body?.phone);
  if (!p10) return res.status(400).json({ error: "invalid phone" });
  const conv = await resolveHandoff(p10);
  if (!conv) return res.status(404).json({ error: "no such conversation" });
  res.json({ ok: true });
}));

app.post("/api/admin/call", admin, wrap(async (req, res) => {
  const p10 = phone10(req.body?.phone);
  if (!p10) return res.status(400).json({ error: "invalid phone" });
  try {
    const attempt_id = await voice.dialOut(p10, { source: "dashboard" });
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
app.get("/admin/logo-mark.png", (req, res) => res.sendFile(join(dir, "public", "logo-mark.png")));

// ---------------- voice pipeline (Vobiz call audio <-> Sarvam STT/TTS <-> Gemini brain) ----------------

voice.attach(httpServer, app);

httpServer.listen(PORT, () => {
  console.log(`marketingravan server listening on :${PORT}`);
  console.log(`  agent auto-reply: ${AGENT_AUTOREPLY ? "ON" : "off"}   public demo: ${DEMO_ENABLED ? "on" : "off"}`);
  console.log(`  production: ${productionModel()} via ${defaultEngineId()}`);
  console.log(`  demo:       ${demoModel()} via ${engineFor(modelInfo(demoModel())?.provider ?? "google")}`);
});
