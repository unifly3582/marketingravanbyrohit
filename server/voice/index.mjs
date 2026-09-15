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
import express from "express";
import { WebSocketServer } from "ws";
import { sb, recordCall, upsertLead, completeCall } from "../db.mjs";
import * as vobiz from "./vobiz.mjs";
import { CallSession, greeting } from "./session.mjs";
import { LiveCallSession, LIVE_INPUT_CONTENT_TYPE } from "./live-call-session.mjs";
import { synthesize } from "./sarvam-speech.mjs";
import { WebVoiceSession, WEB_STREAM_PATH, INPUT_SAMPLE_RATE, OUTPUT_SAMPLE_RATE } from "./web-session.mjs";

const env = (k, d) => process.env[k] ?? d;

const publicBase = () => env("PUBLIC_BASE_URL", "http://147.93.28.140:8100");

/**
 * Which brain answers the phone. "live": Gemini Live end to end, ~1 s to
 * reply (live-call-session.mjs). "sarvam": Sarvam STT -> Gemini text ->
 * Sarvam TTS, Priya's voice, ~4 s to reply (session.mjs). Switch with
 * VOICE_ENGINE and a restart; nothing else differs.
 */
const voiceEngine = () => (env("VOICE_ENGINE", "live") === "sarvam" ? "sarvam" : "live");

/**
 * Live sessions by call id, created at dial time so the model is connected
 * and the opener already spoken by the time the stream opens. Removed when
 * the session ends, however it ends.
 */
const phoneSessions = new Map();
function liveSessionFor(attemptId, info) {
  let s = phoneSessions.get(attemptId);
  if (s) return s;
  s = new LiveCallSession({
    attemptId,
    phone10: info.phone10,
    contactName: info.contactName,
    onEnd: (id) => phoneSessions.delete(id),
  });
  phoneSessions.set(attemptId, s);
  return s;
}
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
  // The phone is ringing; get the model on the line now, not after pickup.
  if (voiceEngine() === "live") {
    const info = (await callInfo(attemptId).catch(() => null)) ?? { phone10, contactName: name ?? null };
    liveSessionFor(attemptId, info);
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

/**
 * Vobiz takes several seconds between fetching the answer XML and opening the
 * media stream. The opener is synthesised in that gap, so the first thing the
 * caller hears is not preceded by a Sarvam round trip. Keyed by call id;
 * entries are consumed by the session or dropped after a minute.
 */
const pending = new Map(); // attemptId -> { answeredAt, greetingAudio }
function prepareOpener(attemptId, contactName) {
  if (pending.has(attemptId)) return;
  const greetingAudio = synthesize(greeting(contactName), { sampleRate: 8000 }).catch((err) => {
    console.error("voice opener TTS", attemptId, err.message);
    return null;
  });
  pending.set(attemptId, { answeredAt: Date.now(), greetingAudio });
  setTimeout(() => pending.delete(attemptId), 60_000).unref();
}

// ---------------- website voice agent ----------------
//
// The browser agent is metered separately from the phone agent: it is offered
// to anonymous visitors, it bills by the second of audio, and a single tab left
// open would otherwise run the daily budget down on its own. Two independent
// limits, because they fail differently — a crowd hitting the site at once is
// a concurrency problem, one enthusiast reloading is a per-IP problem.

const WEB_ENABLED = () => (process.env.WEB_VOICE_ENABLED ?? "true") === "true";

/**
 * Where the browser should open the voice socket, when that is not the origin
 * serving the page.
 *
 * marketingravan.com is behind Cloudflare, which terminates TLS and proxies the
 * WebSocket. For a page that is fine; for realtime audio it is not. Measured
 * from an Indian connection on 2026-09-05: 52 ms round trip straight to the
 * Mumbai box, 167 ms through Cloudflare — which was serving that visitor from
 * Singapore — with spikes to 630 ms right after a burst of audio. A voice turn
 * pays that several times over, which is the whole gap between "fast on the dev
 * server" and "sluggish on the live site".
 *
 * Set this to an origin whose DNS record bypasses the proxy (grey cloud) and
 * has its own certificate, e.g. wss://voice.marketingravan.com. Unset, the
 * browser falls back to the page's own origin and nothing changes — so this is
 * safe to deploy before the DNS record exists.
 */
const WEB_WS_ORIGIN = () => process.env.WEB_VOICE_WS_ORIGIN ?? null;
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
      wsOrigin: WEB_WS_ORIGIN(),
      maxSessionSeconds: Math.round(Number(process.env.WEB_VOICE_MAX_SESSION_MS ?? 300_000) / 1000),
      busy: liveSessions >= MAX_CONCURRENT,
    });
  });

  // Vobiz posts the answer callback form-encoded, not as JSON.
  app.post("/api/voice/answer/:callId", express.urlencoded({ extended: true }), async (req, res) => {
    const attemptId = req.params.callId;
    // A call dialed by this process already has its session; no need to go
    // to Supabase (~150 ms) before Vobiz gets its XML.
    const known = phoneSessions.get(attemptId);
    const info = known
      ? { phone10: known.phone10, contactName: known.contactName }
      : await callInfo(attemptId).catch((err) => {
          console.error("voice answer: lookup failed", err.message);
          return null;
        });
    if (!info) {
      console.error("voice answer: unknown call id", attemptId);
      return res.status(404).end();
    }
    // Vobiz posts here on answer (Event=StartApp) and again when the call
    // ends (Event=Hangup, with the cause). The hangup post is the only signal
    // for a call that was never answered — the stream never opens, so no
    // session ever closes the row — and it is what marks those as failed
    // rather than leaving them "dispatched" forever.
    const b = req.body ?? {};
    if (b.Event === "Hangup") {
      const answered = !!b.AnswerTime && b.AnswerTime !== "";
      phoneSessions.get(attemptId)?.abandon(answered ? "caller_hangup" : "no_answer");
      if (!answered) {
        completeCall(attemptId, {
          status: "no_answer",
          duration: 0,
          failure_reason: b.HangupCauseName || b.HangupCause || "not answered",
        }).catch((err) => console.error("voice hangup completeCall", err.message));
      }
      console.log("voice hangup", attemptId.slice(0, 8), b.HangupCauseName ?? "", answered ? `${b.BillDuration ?? "?"}s` : "not answered");
      return res.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`);
    }
    const engine = voiceEngine();
    if (engine === "sarvam") prepareOpener(attemptId, info.contactName);
    else {
      liveSessionFor(attemptId, info);
      pending.set(attemptId, { answeredAt: Date.now(), greetingAudio: null });
    }
    const streamUrl = `${wsBase()}/api/voice/stream/${attemptId}`;
    res.type("text/xml").send(
      vobiz.answerXml(streamUrl, engine === "live" ? { contentType: LIVE_INPUT_CONTENT_TYPE } : {})
    );
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
      // The call row is looked up *before* the upgrade completes. Vobiz sends
      // its "start" event (carrying the streamId) the instant the socket
      // opens; doing the lookup after "connection" left a ~200 ms window
      // with no message listener, and that first event was silently lost —
      // no streamId, no greeting, and playAudio frames stamped with null.
      // (Observed on the first live call, 2026-09-15.) Data that arrives
      // during the lookup stays buffered on the raw socket until
      // handleUpgrade attaches the WebSocket parser.
      const attemptId = match[1];
      const known = phoneSessions.get(attemptId);
      (known ? Promise.resolve({ phone10: known.phone10, contactName: known.contactName }) : callInfo(attemptId))
        .catch(() => null)
        .then((info) => {
          if (!info) {
            console.error("voice stream: unmatched call id", attemptId);
            socket.destroy();
            return;
          }
          const prepared = pending.get(attemptId) ?? null;
          pending.delete(attemptId);
          if (prepared) console.log("voice stream open", attemptId.slice(0, 8), `${Date.now() - prepared.answeredAt} ms after answer`);
          wss.handleUpgrade(req, socket, head, (ws) => {
            if (voiceEngine() === "live") {
              liveSessionFor(attemptId, info).attach(ws);
              return;
            }
            new CallSession(ws, {
              attemptId,
              phone10: info.phone10,
              contactName: info.contactName,
              greetingAudio: prepared?.greetingAudio ?? null,
            });
          });
        });
      return;
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
          mode: searchParams.get("mode") ?? "voice",
          intent: searchParams.get("intent") ?? null,
          onClose: () => { liveSessions = Math.max(0, liveSessions - 1); },
        });
      });
    }

    socket.destroy();
  });

  console.log("voice pipeline attached: POST /api/voice/answer/:callId, WS /api/voice/stream/:callId");
  console.log(
    `web voice agent: WS ${WEB_STREAM_PATH} (${WEB_ENABLED() ? "on" : "off"}, max ${MAX_CONCURRENT} concurrent)` +
      `  socket origin: ${WEB_WS_ORIGIN() ?? "same as the page"}`
  );
}
