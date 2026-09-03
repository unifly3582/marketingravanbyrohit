// WhatsApp send/receive via the crm.marketingravan.com BSP panel (Meta-proxy).
// Patterns ported from the battle-tested Buggly Farms OMS integration.
import { db, touchConversation } from "./db.mjs";

const env = (k) => process.env[k];
const base = () => `${env("WA_API_URL")}/${env("WA_API_VERSION")}`;
const headers = () => ({
  Authorization: `Bearer ${env("WA_ACCESS_TOKEN")}`,
  "Content-Type": "application/json",
});

export const phone10 = (raw) => {
  const d = String(raw ?? "").replace(/\D/g, "");
  if (/^[6-9]\d{9}$/.test(d)) return d;
  if (/^91[6-9]\d{9}$/.test(d)) return d.slice(2);
  return null;
};

async function post(path, payload) {
  const res = await fetch(`${base()}${path}`, { method: "POST", headers: headers(), body: JSON.stringify(payload) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || data?.error || `WA API ${res.status}`);
  return data;
}

function logOutbound(p10, fields, preview, openWindow = false) {
  db.prepare(
    `INSERT INTO wa_messages (phone10, direction, type, text, caption, button_payload, message_id, status, source, timestamp)
     VALUES (?, 'out', ?, ?, ?, NULL, ?, 'sent', ?, ?)`
  ).run(p10, fields.type ?? "text", fields.text ?? null, fields.caption ?? null, fields.messageId ?? null, fields.source ?? "reply", new Date().toISOString());
  touchConversation(p10, { text: preview, direction: "out", openWindow });
}

/** Send an approved template (allowed any time; the only way to open a closed conversation). */
export async function sendTemplate(p10, name, language = "en", bodyParams = [], source = "reply") {
  const components = bodyParams.length
    ? [{ type: "body", parameters: bodyParams.map((t) => ({ type: "text", text: String(t) })) }]
    : [];
  const data = await post(`/${env("WA_PHONE_NUMBER_ID")}/messages`, {
    messaging_product: "whatsapp",
    to: `91${p10}`,
    recipient_type: "individual",
    type: "template",
    template: { language: { policy: "deterministic", code: language }, name, components },
  });
  const id = data.message?.queue_id || data.messages?.[0]?.id || null;
  logOutbound(p10, { type: "template", text: `[template] ${name}`, messageId: id, source }, `[template] ${name}`);
  return { messageId: id };
}

/** Send free-form text — only inside the 24h customer-service window. */
export async function sendText(p10, text, source = "reply") {
  const data = await post(`/${env("WA_PHONE_NUMBER_ID")}/messages`, {
    messaging_product: "whatsapp",
    to: `91${p10}`,
    recipient_type: "individual",
    type: "text",
    text: { preview_url: false, body: text },
  });
  const id = data.message?.queue_id || data.messages?.[0]?.id || null;
  logOutbound(p10, { type: "text", text, messageId: id, source }, text);
  return { messageId: id };
}

// ---------- inbound webhook parsing (ported from the OMS) ----------

const onlyDigits = (v) => (v == null ? "" : String(v).replace(/\D/g, ""));

function deepFind(obj, keys) {
  if (obj == null || typeof obj !== "object") return undefined;
  for (const k of Object.keys(obj)) {
    if (keys.includes(k) && obj[k] != null && typeof obj[k] !== "object") return obj[k];
  }
  for (const k of Object.keys(obj)) {
    const found = deepFind(obj[k], keys);
    if (found !== undefined) return found;
  }
  return undefined;
}
function deepFindObj(obj, keys) {
  if (obj == null || typeof obj !== "object") return undefined;
  for (const k of Object.keys(obj)) {
    if (keys.includes(k) && obj[k] != null) return obj[k];
  }
  for (const k of Object.keys(obj)) {
    const found = deepFindObj(obj[k], keys);
    if (found !== undefined) return found;
  }
  return undefined;
}
function deepHas(obj, keys) {
  if (obj == null || typeof obj !== "object") return false;
  for (const k of Object.keys(obj)) {
    if (keys.includes(k)) {
      const v = obj[k];
      if (Array.isArray(v) ? v.length > 0 : v != null) return true;
    }
  }
  return Object.keys(obj).some((k) => deepHas(obj[k], keys));
}

function isSendAck(payload) {
  return deepFind(payload, ["queue_id", "message_status"]) !== undefined;
}

export function classify(payload) {
  if (isSendAck(payload)) return "ack";
  if (deepHas(payload, ["message_echoes", "smb_message_echoes"])) return "outgoing";
  const hasContent = deepFind(payload, ["text", "button", "interactive", "body", "caption"]) !== undefined;
  const hasStatus = deepHas(payload, ["statuses"]) || deepFind(payload, ["status"]) !== undefined;
  if (hasContent) return "incoming";
  if (hasStatus) return "status";
  return "unknown";
}

function readMessage(m) {
  const type = m?.type || "text";
  const r = { msgType: type, text: "", caption: null, buttonPayload: null, mediaId: null, mimeType: null, filename: null };
  switch (type) {
    case "text": r.text = m.text?.body ?? ""; break;
    case "image": Object.assign(r, { text: m.image?.caption || "", caption: m.image?.caption || null, mediaId: m.image?.id || null, mimeType: m.image?.mime_type || "image/jpeg" }); break;
    case "video": Object.assign(r, { text: m.video?.caption || "", caption: m.video?.caption || null, mediaId: m.video?.id || null, mimeType: m.video?.mime_type || "video/mp4" }); break;
    case "audio": case "voice": Object.assign(r, { msgType: "audio", mediaId: m.audio?.id || m.voice?.id || null, mimeType: m.audio?.mime_type || m.voice?.mime_type || "audio/ogg" }); break;
    case "document": Object.assign(r, { text: m.document?.filename || "", caption: m.document?.caption || null, filename: m.document?.filename || null, mediaId: m.document?.id || null, mimeType: m.document?.mime_type || null }); break;
    case "sticker": Object.assign(r, { mediaId: m.sticker?.id || null, mimeType: m.sticker?.mime_type || "image/webp" }); break;
    case "location": r.text = m.location?.name || m.location?.address || "[location]"; break;
    case "button": Object.assign(r, { text: m.button?.text || "", buttonPayload: m.button?.payload || m.button?.text || null }); break;
    case "interactive": {
      const i = m.interactive || {};
      const reply = i.button_reply || i.list_reply || {};
      Object.assign(r, { text: reply.title || "", buttonPayload: reply.id || reply.title || null });
      break;
    }
    default: r.text = `[${type}]`;
  }
  return r;
}

/** Ingest one webhook POST body: store raw, then messages/statuses into the DB. */
export function ingest(payload) {
  const kind = classify(payload);
  db.prepare(`INSERT INTO wa_events_raw (kind, payload) VALUES (?, ?)`).run(kind, JSON.stringify(payload));
  if (kind === "ack" || kind === "unknown") return { kind };

  if (kind === "status") {
    const statuses = deepFindObj(payload, ["statuses"]);
    for (const s of Array.isArray(statuses) ? statuses : []) {
      if (s?.id && s?.status) {
        db.prepare(`UPDATE wa_messages SET status = ? WHERE message_id = ?`).run(s.status, s.id);
      }
    }
    return { kind };
  }

  const messages = deepFindObj(payload, ["messages", "message_echoes", "smb_message_echoes"]);
  const contacts = deepFindObj(payload, ["contacts"]);
  const contactName = Array.isArray(contacts) ? contacts[0]?.profile?.name ?? null : null;
  let count = 0;
  for (const m of Array.isArray(messages) ? messages : []) {
    const from = phone10(onlyDigits(m.from ?? deepFind(payload, ["from", "wa_id"])));
    if (!from) continue;
    const r = readMessage(m);
    const hasContent = (r.text && r.text.trim()) || r.mediaId || r.buttonPayload || r.msgType !== "text";
    if (kind === "incoming" && !hasContent) continue;
    const direction = kind === "outgoing" ? "out" : "in";
    db.prepare(
      `INSERT INTO wa_messages (phone10, direction, type, text, caption, media_id, mime_type, filename, button_payload, message_id, source, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      from, direction, r.msgType, r.text || null, r.caption, r.mediaId, r.mimeType, r.filename, r.buttonPayload,
      m.id ?? null, direction === "out" ? "phone-echo" : null,
      m.timestamp ? new Date(Number(m.timestamp) * 1000).toISOString() : new Date().toISOString()
    );
    touchConversation(from, {
      text: r.text || r.caption || `[${r.msgType}]`,
      direction,
      contactName,
      openWindow: direction === "in",   // an inbound message opens the 24h window
      bumpUnread: direction === "in",
    });
    count++;
  }
  return { kind, count };
}
