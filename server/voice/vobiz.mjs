// Vobiz REST client: outbound dialing + the XML answer response that opens
// the live media WebSocket. This replaces Sarvam's Conversatio "outbounds"
// API as the telephony layer — Vobiz just carries audio; Sarvam (STT/TTS) and
// Gemini (the brain) live entirely in our own process from here on.
//
// https://docs.vobiz.ai/call/make-call

const env = (k, d) => process.env[k] ?? d;

const authId = () => env("VOBIZ_AUTH_ID");
const authToken = () => env("VOBIZ_AUTH_TOKEN");

/**
 * Place an outbound call. Vobiz will POST to `answerUrl` once the callee
 * picks up; that handler (see voice/index.mjs) must answer with the XML from
 * `answerXml()` to open the media stream.
 *
 * @param {string} toE164        e.g. "+919876543210"
 * @param {string} answerUrl
 * @returns {Promise<{requestUuid: string, raw: object}>}
 */
export async function dialOut(toE164, answerUrl) {
  const id = authId();
  const token = authToken();
  if (!id || !token) throw new Error("VOBIZ_AUTH_ID / VOBIZ_AUTH_TOKEN not configured");

  const res = await fetch(`https://api.vobiz.ai/api/v1/Account/${id}/Call/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Auth-ID": id, "X-Auth-Token": token },
    body: JSON.stringify({
      from: env("VOBIZ_FROM_NUMBER", env("AGENT_PHONE_NUMBER")),
      to: toE164,
      answer_url: answerUrl,
      answer_method: "POST",
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`vobiz dial ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
  const requestUuid = data.request_uuid ?? data.RequestUUID ?? null;
  if (!requestUuid) throw new Error(`vobiz dial: no request_uuid in response: ${JSON.stringify(data).slice(0, 300)}`);
  return { requestUuid, raw: data };
}

/**
 * Best-effort extraction of Vobiz's call identifier from the answer_url
 * callback body, so the media-stream WebSocket (opened moments later) can be
 * tied back to the same `calls` row `dialOut()` created. Vobiz's exact field
 * name for this isn't nailed down from the docs alone — check the real
 * payload on the first test call and adjust this list if none of these hit.
 */
export function callIdFromAnswerBody(body = {}) {
  return body.CallUUID ?? body.call_uuid ?? body.RequestUUID ?? body.request_uuid ?? null;
}

/** XML response for the answer_url callback: open a bidirectional media stream to our WS endpoint. */
export function answerXml(streamUrl) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n  <Stream bidirectional="true" keepCallAlive="true">${streamUrl}</Stream>\n</Response>`;
}
