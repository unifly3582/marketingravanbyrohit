// Marketing Ravan backend: call requests, Sarvam + WhatsApp webhooks,
// voice-agent WhatsApp tool, and the admin dashboard API.
import express from "express";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { db, upsertLead, windowOpen } from "./db.mjs";
import { phone10, sendTemplate, sendText, ingest } from "./wa.mjs";

const dir = dirname(fileURLToPath(import.meta.url));

// Env: process.env first, then server/.env fallback for local dev.
const envFile = join(dir, ".env");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    if (!line.includes("=") || line.trim().startsWith("#")) continue;
    const k = line.slice(0, line.indexOf("=")).trim();
    const v = line.slice(line.indexOf("=") + 1).trim();
    if (!(k in process.env)) process.env[k] = v;
  }
}
const env = (k, d) => process.env[k] ?? d;

const PORT = Number(env("PORT", 8787));
const PUBLIC_BASE_URL = env("PUBLIC_BASE_URL", "http://147.93.28.140:8100");
const ADMIN_PASSWORD = env("ADMIN_PASSWORD");
const AGENT_TOOL_TOKEN = env("AGENT_TOOL_TOKEN");

for (const k of ["SARVAM_SAMVAAD_API_KEY", "SARVAM_ORG_ID", "SARVAM_WORKSPACE_ID", "AGENT_PHONE_NUMBER"]) {
  if (!env(k)) { console.error(`Missing env ${k}`); process.exit(1); }
}

const app = express();
app.use(express.json({ limit: "2mb" }));
app.set("trust proxy", true);

// ---------------- call requests (site button) ----------------

const PER_IP_PER_HOUR = 3;
const GLOBAL_PER_DAY = 100;
const ipHits = new Map();
let dayCount = { day: new Date().toDateString(), n: 0 };
function limited(ip) {
  const now = Date.now();
  const hits = (ipHits.get(ip) ?? []).filter((t) => now - t < 3600_000);
  if (hits.length >= PER_IP_PER_HOUR) return "Too many requests. Try again later.";
  const today = new Date().toDateString();
  if (dayCount.day !== today) dayCount = { day: today, n: 0 };
  if (dayCount.n >= GLOBAL_PER_DAY) return "Daily call limit reached. Please use WhatsApp or email instead.";
  hits.push(now); ipHits.set(ip, hits); dayCount.n++;
  return null;
}

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
  upsertLead(p10, { name, source, status: "called" });
  db.prepare(`INSERT INTO calls (attempt_id, phone10) VALUES (?, ?)`).run(data.attempt_id ?? null, p10);
  return data.attempt_id;
}

app.post("/api/request-call", async (req, res) => {
  try {
    const p10 = phone10(req.body?.phone);
    if (!p10) return res.status(400).json({ error: "Please enter a valid 10-digit Indian mobile number." });
    const msg = limited(req.ip);
    if (msg) return res.status(429).json({ error: msg });
    const attempt_id = await dispatchCall(p10, { name: req.body?.name, source: req.body?.source ?? "website" });
    res.json({ ok: true, attempt_id });
  } catch (e) {
    console.error("request-call", e.message);
    res.status(502).json({ error: "Could not place the call right now. Please try again in a minute." });
  }
});

// ---------------- Sarvam webhook (call finished → transcript) ----------------

app.post("/api/webhooks/sarvam", (req, res) => {
  if (req.query.token !== env("SARVAM_WEBHOOK_TOKEN", "mr-hook")) return res.status(403).end();
  const p = req.body ?? {};
  const p10 = p.webhook_config?.metadata?.phone10 ?? null;
  db.prepare(
    `UPDATE calls SET status = ?, duration = ?, transcript = ?, variables = ?, failure_reason = ?, interaction_id = ?, completed_at = datetime('now')
     WHERE attempt_id = ?`
  ).run(
    p.status ?? "unknown",
    p.duration ?? null,
    p.interaction_transcript ? JSON.stringify(p.interaction_transcript) : null,
    p.final_agent_variables ? JSON.stringify(p.final_agent_variables) : null,
    p.failure_reason ?? null,
    p.interaction_id ?? null,
    p.attempt_id
  );
  if (p10) upsertLead(p10, { status: p.status === "connected" ? "talked" : "call_failed" });
  console.log("sarvam webhook", p.attempt_id, p.status, "dur:", p.duration);
  res.json({ ok: true });
});

// ---------------- WhatsApp webhook (BSP panel) ----------------

// Verification handshake: echo the `challange` query param (BSP's spelling).
app.get("/api/webhooks/whatsapp", (req, res) => {
  const c = req.query.challange ?? req.query.challenge ?? "no challange";
  res.status(200).type("text/html").send(String(c));
});

app.post("/api/webhooks/whatsapp", (req, res) => {
  try {
    const out = ingest(req.body ?? {});
    console.log("wa webhook", out.kind, out.count ?? "");
  } catch (e) {
    console.error("wa webhook error", e.message);
  }
  res.json({ ok: true }); // always 200 so the BSP doesn't retry-storm
});

// ---------------- voice-agent tool: send WhatsApp mid-call ----------------

app.post("/api/agent/whatsapp", async (req, res) => {
  if (!AGENT_TOOL_TOKEN || req.headers["x-tool-token"] !== AGENT_TOOL_TOKEN)
    return res.status(403).json({ error: "forbidden" });
  try {
    const p10 = phone10(req.body?.phone);
    if (!p10) return res.status(400).json({ error: "invalid phone" });
    if (req.body?.text && windowOpen(p10)) {
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
});

// ---------------- admin API ----------------

function admin(req, res, next) {
  if (!ADMIN_PASSWORD) return res.status(500).json({ error: "ADMIN_PASSWORD not configured" });
  const auth = req.headers.authorization ?? "";
  if (auth === `Bearer ${ADMIN_PASSWORD}`) return next();
  res.status(401).json({ error: "unauthorized" });
}

app.get("/api/admin/overview", admin, (req, res) => {
  const one = (sql) => Object.values(db.prepare(sql).get())[0];
  res.json({
    leads: one(`SELECT COUNT(*) FROM leads`),
    calls: one(`SELECT COUNT(*) FROM calls`),
    connected: one(`SELECT COUNT(*) FROM calls WHERE status = 'connected'`),
    conversations: one(`SELECT COUNT(*) FROM wa_conversations`),
    unread: one(`SELECT COALESCE(SUM(unread),0) FROM wa_conversations`),
    calls_today: one(`SELECT COUNT(*) FROM calls WHERE date(created_at) = date('now')`),
  });
});

app.get("/api/admin/calls", admin, (req, res) => {
  res.json(db.prepare(
    `SELECT c.id, c.attempt_id, c.phone10, l.name, c.status, c.duration, c.created_at, c.completed_at,
            c.transcript IS NOT NULL AS has_transcript
     FROM calls c LEFT JOIN leads l ON l.phone10 = c.phone10
     ORDER BY c.id DESC LIMIT 200`
  ).all());
});

app.get("/api/admin/calls/:id", admin, (req, res) => {
  const row = db.prepare(`SELECT * FROM calls WHERE id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: "not found" });
  row.transcript = row.transcript ? JSON.parse(row.transcript) : null;
  row.variables = row.variables ? JSON.parse(row.variables) : null;
  res.json(row);
});

app.get("/api/admin/conversations", admin, (req, res) => {
  res.json(db.prepare(`SELECT * FROM wa_conversations ORDER BY last_message_at DESC LIMIT 200`).all());
});

app.get("/api/admin/messages", admin, (req, res) => {
  const p10 = phone10(req.query.phone);
  if (!p10) return res.status(400).json({ error: "invalid phone" });
  db.prepare(`UPDATE wa_conversations SET unread = 0 WHERE phone10 = ?`).run(p10);
  res.json(db.prepare(`SELECT * FROM wa_messages WHERE phone10 = ? ORDER BY id ASC LIMIT 500`).all(p10));
});

app.post("/api/admin/send", admin, async (req, res) => {
  try {
    const p10 = phone10(req.body?.phone);
    if (!p10) return res.status(400).json({ error: "invalid phone" });
    if (req.body?.template) {
      const r = await sendTemplate(p10, req.body.template, req.body.language ?? "en", req.body.params ?? []);
      return res.json({ ok: true, messageId: r.messageId });
    }
    if (!windowOpen(p10))
      return res.status(409).json({ error: "24-hour window closed — send an approved template instead." });
    const r = await sendText(p10, String(req.body?.text ?? "").trim());
    res.json({ ok: true, messageId: r.messageId });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

app.post("/api/admin/call", admin, async (req, res) => {
  try {
    const p10 = phone10(req.body?.phone);
    if (!p10) return res.status(400).json({ error: "invalid phone" });
    const attempt_id = await dispatchCall(p10, { source: "dashboard" });
    res.json({ ok: true, attempt_id });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

app.get("/api/admin/offers", admin, (req, res) => {
  res.json(db.prepare(`SELECT * FROM offers ORDER BY id DESC`).all());
});
app.post("/api/admin/offers", admin, (req, res) => {
  const { id, name, pitch, goal, active } = req.body ?? {};
  if (!name || !pitch) return res.status(400).json({ error: "name and pitch required" });
  if (active) db.prepare(`UPDATE offers SET active = 0`).run();
  if (id) {
    db.prepare(`UPDATE offers SET name=?, pitch=?, goal=?, active=?, updated_at=datetime('now') WHERE id=?`)
      .run(name, pitch, goal ?? null, active ? 1 : 0, id);
  } else {
    db.prepare(`INSERT INTO offers (name, pitch, goal, active) VALUES (?,?,?,?)`)
      .run(name, pitch, goal ?? null, active ? 1 : 0);
  }
  res.json({ ok: true });
});

// ---------------- dashboard page ----------------

app.get(["/admin", "/admin/"], (req, res) => res.sendFile(join(dir, "public", "admin.html")));

app.listen(PORT, () => console.log(`marketingravan server listening on :${PORT}`));
