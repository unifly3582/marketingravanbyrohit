// Wires the voice pipeline into the Express app + HTTP server:
//   dialOut()            -- place an outbound call (mirrors the old dispatchCall())
//   POST /api/voice/answer  -- Vobiz's answer_url callback, opens the media stream
//   WS   /api/voice/stream  -- the live call audio, one CallSession per connection
//
// The `calls` row is written *before* Vobiz is asked to dial, using an id we
// generate ourselves (not one of Vobiz's own call ids). That sidesteps having
// to guess which field in Vobiz's answer callback carries their call
// identifier — our id is a path segment on the URLs we hand Vobiz (Vobiz's
// answer_url validation 400s on a query string — confirmed against the real
// API, not just docs), and by the time any callback can arrive the row
// already exists to look it back up from.

import { randomUUID } from "node:crypto";
import { WebSocketServer } from "ws";
import { sb, recordCall, upsertLead, completeCall } from "../db.mjs";
import * as vobiz from "./vobiz.mjs";
import { CallSession } from "./session.mjs";
import { WebVoiceSession, WEB_STREAM_PATH, INPUT_SAMPLE_RATE, OUTPUT_SAMPLE_RATE } from "./web-session.mjs";

const env = (k, d) => process.env[k] ?? d;

const publicBase = () => env("PUBLIC_BASE_URL", "http://147.93.28.140:8100");
/** wss:// over https, ws:// over http — derived from PUBLIC_BASE_URL so there's one source of truth for the host. */
const wsBase = () => publicBase().replace(/^http/, "ws");

/** Place an outbound call. Same shape/return as the old Sarvam dispatchCall(): an attempt id. */
export async function dialOut(phone10, { name, source = "website" } = {}) {
  const attemptId = randomUUID();
  if (name) await upsertLead(phone10, { name });
  await recordCall(phone10, attemptId, source);

  try {
    await vobiz.dialOut(`+91${phone10}`, `${publicBase()}/api/voice/answer/${attemptId}`);
  } catch (err) {
    await completeCall(attemptId, { status: "dial_failed", duration: 0, failure_reason: err.message }).catch(() => {});
    throw err;
  }
  return attemptId;
}

/** Look up the phone number (and lead name, for a friendlier prompt) a call id belongs to. */
async function callInfo(attemptId) {
  const { data } = await sb
    .from("calls")
    .select("phone10, leads(name)")
    .eq("attempt_id", attemptId)
    .maybeSingle();
  return data ? { phone10: data.phone10, contactName: data.leads?.name ?? null } : null;
}

const STREAM_PATH_RE = /^\/api\/voice\/stream\/([^/]+)$/;

// ---------------- website voice agent ----------------
//
// The browser agent is metered separately from the phone agent: it is offered
// to anonymous visitors, it bills by the second of audio, and a single tab left
// open would otherwise run the daily budget down on its own. Two independent
// limits, because they fail differently — a crowd hitting the site at once is
// a concurrency problem, one enthusiast reloading is a per-IP problem.

const WEB_ENABLED = () => (process.env.WEB_VOICE_ENABLED ?? "true") === "true";
const MAX_CONCURRENT = Number(process.env.WEB_VOICE_MAX_CONCURRENT ?? 4);
const PER_IP_PER_HOUR = Number(process.env.WEB_VOICE_PER_IP_PER_HOUR ?? 4);
const PER_DAY = Number(process.env.WEB_VOICE_PER_DAY ?? 150);

let liveSessions = 0;
const ipHits = new Map();
let dayCount = { day: new Date().toDateString(), n: 0 };

/** null when the visitor may start a session, otherwise why not. */
function webVoiceGate(ip) {
  if (!WEB_ENABLED()) return "The voice agent is switched off right now.";
  if (liveSessions >= MAX_CONCURRENT) return "All our agents are busy. Try again in a minute.";
  const now = Date.now();
  const hits = (ipHits.get(ip) ?? []).filter((t) => now - t < 3600_000);
  if (hits.length >= PER_IP_PER_HOUR) return "You have used your demo sessions for this hour.";
  const today = new Date().toDateString();
  if (dayCount.day !== today) dayCount = { day: today, n: 0 };
  if (dayCount.n >= PER_DAY) return "The voice demo has hit today's limit. Book a call instead.";
  hits.push(now);
  ipHits.set(ip, hits);
  dayCount.n++;
  return null;
}

export function attach(httpServer, app) {
  // What the browser needs before it asks for the microphone: whether the
  // agent is even available, and the exact audio format to capture in.
  app.get("/api/voice/web/config", (req, res) => {
    res.json({
      enabled: WEB_ENABLED(),
      path: WEB_STREAM_PATH,
      inputSampleRate: INPUT_SAMPLE_RATE,
      outputSampleRate: OUTPUT_SAMPLE_RATE,
      inputCodec: "mulaw",
      maxSessionSeconds: Math.round(Number(process.env.WEB_VOICE_MAX_SESSION_MS ?? 300_000) / 1000),
      busy: liveSessions >= MAX_CONCURRENT,
    });
  });

  app.post("/api/voice/answer/:callId", async (req, res) => {
    const attemptId = req.params.callId;
    const info = await callInfo(attemptId).catch((err) => {
      console.error("voice answer: lookup failed", err.message);
      return null;
    });
    if (!info) {
      console.error("voice answer: unknown call id", attemptId);
      return res.status(404).end();
    }
    const streamUrl = `${wsBase()}/api/voice/stream/${attemptId}`;
    res.type("text/xml").send(vobiz.answerXml(streamUrl));
  });

  // `path` on WebSocketServer only matches a fixed string, and the call id is
  // part of the path (see the comment up top on why it's not a query param),
  // so the upgrade is handled manually and routed by regex instead.
  const wss = new WebSocketServer({ noServer: true });
  const webWss = new WebSocketServer({ noServer: true });

  // One upgrade handler for the whole server: Node fires every registered
  // listener for the same socket, so two handlers that each destroy what they
  // don't recognise would race to kill each other's connections.
  httpServer.on("upgrade", (req, socket, head) => {
    const { pathname, searchParams } = new URL(req.url, "http://internal");

    const match = pathname.match(STREAM_PATH_RE);
    if (match) {
      return wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req, match[1]));
    }

    if (pathname === WEB_STREAM_PATH) {
      const ip = req.headers["x-forwarded-for"]?.split(",")[0].trim() ?? req.socket.remoteAddress;
      const denied = webVoiceGate(ip);
      if (denied) {
        // The visitor is about to see a spinner, so say why in the close frame
        // rather than dropping the socket with no explanation.
        return webWss.handleUpgrade(req, socket, head, (ws) => {
          ws.send(JSON.stringify({ type: "error", message: denied }));
          ws.close(1013, "unavailable");
        });
      }
      return webWss.handleUpgrade(req, socket, head, (ws) => {
        liveSessions++;
        new WebVoiceSession(ws, {
          dialOut,
          page: searchParams.get("page") ?? "/",
          codec: searchParams.get("codec") ?? "pcm16",
          onClose: () => { liveSessions = Math.max(0, liveSessions - 1); },
        });
      });
    }

    socket.destroy();
  });

  wss.on("connection", async (ws, req, attemptId) => {
    const info = await callInfo(attemptId).catch(() => null);
    if (!info) {
      console.error("voice stream: unmatched call id", attemptId);
      ws.close();
      return;
    }
    new CallSession(ws, { attemptId, phone10: info.phone10, contactName: info.contactName });
  });

  console.log("voice pipeline attached: POST /api/voice/answer/:callId, WS /api/voice/stream/:callId");
  console.log(`web voice agent: WS ${WEB_STREAM_PATH} (${WEB_ENABLED() ? "on" : "off"}, max ${MAX_CONCURRENT} concurrent)`);
}
