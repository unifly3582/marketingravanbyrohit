// Marketing Ravan — call-request API.
// POST /api/request-call {name?, phone} → triggers a Sarvam instant outbound call.
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dir = dirname(fileURLToPath(import.meta.url));

// Env: process.env first, then server/.env as fallback for local dev.
const envFile = join(dir, ".env");
const fileEnv = existsSync(envFile)
  ? Object.fromEntries(
      readFileSync(envFile, "utf8")
        .split(/\r?\n/)
        .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
        .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
    )
  : {};
const env = (k) => process.env[k] ?? fileEnv[k];

const API_KEY = env("SARVAM_SAMVAAD_API_KEY");
const ORG_ID = env("SARVAM_ORG_ID");
const WORKSPACE_ID = env("SARVAM_WORKSPACE_ID");
const AGENT_PHONE = env("AGENT_PHONE_NUMBER");
const APP_ID = env("SARVAM_APP_ID") ?? "Conversatio-1b327c92-3694";
const APP_VERSION = Number(env("SARVAM_APP_VERSION") ?? 2);
const CONNECTION_ID = env("SARVAM_CONNECTION_ID") ?? "8efca9cf-94-b9219a1c-5823";
const PORT = Number(env("PORT") ?? 8787);

if (!API_KEY || !ORG_ID || !WORKSPACE_ID || !AGENT_PHONE) {
  console.error("Missing Sarvam env vars (SARVAM_SAMVAAD_API_KEY, SARVAM_ORG_ID, SARVAM_WORKSPACE_ID, AGENT_PHONE_NUMBER)");
  process.exit(1);
}

// Rate limits: protect the Sarvam wallet from abuse.
const PER_IP_PER_HOUR = 3;
const GLOBAL_PER_DAY = 100;
const ipHits = new Map(); // ip -> [timestamps]
let dayCount = { day: new Date().toDateString(), n: 0 };

function limited(ip) {
  const now = Date.now();
  const hits = (ipHits.get(ip) ?? []).filter((t) => now - t < 3600_000);
  if (hits.length >= PER_IP_PER_HOUR) return "Too many requests from this number/IP. Try again later.";
  const today = new Date().toDateString();
  if (dayCount.day !== today) dayCount = { day: today, n: 0 };
  if (dayCount.n >= GLOBAL_PER_DAY) return "Daily call limit reached. Please use WhatsApp or email instead.";
  hits.push(now);
  ipHits.set(ip, hits);
  dayCount.n++;
  return null;
}

function normalizePhone(raw) {
  const digits = String(raw ?? "").replace(/[^\d]/g, "");
  if (/^[6-9]\d{9}$/.test(digits)) return `+91${digits}`;
  if (/^91[6-9]\d{9}$/.test(digits)) return `+${digits}`;
  return null;
}

const json = (res, status, body) => {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  });
  res.end(JSON.stringify(body));
};

createServer(async (req, res) => {
  if (req.method === "OPTIONS") return json(res, 204, {});
  if (req.method !== "POST" || new URL(req.url, "http://x").pathname !== "/api/request-call")
    return json(res, 404, { error: "Not found" });

  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", async () => {
    try {
      const { phone } = JSON.parse(body || "{}");
      const to = normalizePhone(phone);
      if (!to) return json(res, 400, { error: "Please enter a valid 10-digit Indian mobile number." });

      const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ?? req.socket.remoteAddress;
      const limitMsg = limited(ip);
      if (limitMsg) return json(res, 429, { error: limitMsg });

      const r = await fetch(
        `https://apps.sarvam.ai/api/outbounds/v1/orgs/${ORG_ID}/workspaces/${WORKSPACE_ID}/outbounds`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": API_KEY,
            Authorization: `Bearer ${API_KEY}`,
          },
          body: JSON.stringify({
            app_config: {
              app_id: APP_ID,
              app_version: APP_VERSION,
              connection_config: { connection_id: CONNECTION_ID, agent_phone_number: AGENT_PHONE },
            },
            user_config: { user_phone_number: to },
          }),
        }
      );
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        console.error("Sarvam error", r.status, JSON.stringify(data).slice(0, 300));
        return json(res, 502, { error: "Could not place the call right now. Please try again in a minute." });
      }
      console.log(new Date().toISOString(), "call dispatched", to.slice(0, 6) + "****", data.attempt_id);
      return json(res, 200, { ok: true, attempt_id: data.attempt_id });
    } catch (e) {
      console.error(e);
      return json(res, 500, { error: "Something went wrong." });
    }
  });
}).listen(PORT, () => console.log(`call-request API listening on :${PORT}`));
