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

export function attach(httpServer, app) {
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
  httpServer.on("upgrade", (req, socket, head) => {
    const { pathname } = new URL(req.url, "http://internal");
    const match = pathname.match(STREAM_PATH_RE);
    if (!match) return socket.destroy();
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req, match[1]));
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
}
