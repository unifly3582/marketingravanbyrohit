// WhatsApp numbers linked through WAHA (waha.marketingravan.com), shown in the
// dashboard under "Linked numbers".
//
// Deliberately separate from wa.mjs and the conversations/messages tables:
// those are the BSP inbox, keyed on the customer's phone10 alone, and the
// agent answers them. A linked number is someone's own WhatsApp, so a
// customer can talk to several of them, and nothing here replies on its own.
//
// Env: WAHA_URL (e.g. http://127.0.0.1:3300), WAHA_API_KEY, and
// WAHA_WEBHOOK_TOKEN — the shared secret WAHA sends in X-Webhook-Token.
import { sb, unwrap } from "./db.mjs";

const env = (k, d) => process.env[k] ?? d;
const wahaUrl = () => String(env("WAHA_URL", "http://127.0.0.1:3300")).replace(/\/+$/, "");

async function waha(path, opts = {}) {
  const res = await fetch(`${wahaUrl()}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", "X-Api-Key": env("WAHA_API_KEY", ""), ...(opts.headers ?? {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || data?.error || `WAHA ${res.status}`);
  return data;
}

export function webhookTokenOk(req) {
  const want = env("WAHA_WEBHOOK_TOKEN");
  if (!want) return false; // never run open: WAHA is configured with the token
  return req.headers["x-webhook-token"] === want;
}

const digits = (v) => String(v ?? "").replace(/\D/g, "");

/** Only one-to-one chats: no groups, channels, broadcasts or status updates. */
const isPersonalChat = (id) => /@(c\.us|s\.whatsapp\.net|lid)$/.test(String(id ?? ""));

// WhatsApp increasingly addresses people by a private "lid" instead of their
// number. WAHA can map one back to a phone number; remember the answers.
const lidCache = new Map();
async function phoneFor(session, chatId, data) {
  if (/@(c\.us|s\.whatsapp\.net)$/.test(chatId)) return digits(chatId.split("@")[0]);
  const alt = data?.Info?.SenderAlt || data?.Info?.RecipientAlt || data?.Info?.ChatAlt;
  if (alt && /@s\.whatsapp\.net$/.test(alt)) return digits(alt.split("@")[0].split(":")[0]);
  if (lidCache.has(chatId)) return lidCache.get(chatId);
  try {
    const r = await waha(`/api/${encodeURIComponent(session)}/lids/${encodeURIComponent(chatId)}`);
    const pn = r?.pn ? digits(String(r.pn).split("@")[0]) : null;
    lidCache.set(chatId, pn);
    return pn;
  } catch {
    return null;
  }
}

const NOT_CHAT = new Set([
  "messageContextInfo", "protocolMessage", "senderKeyDistributionMessage", "pollUpdateMessage",
  "reactionMessage", "encReactionMessage", "keepInChatMessage", "editedMessage", "deviceSentMessage",
]);
const rawMessage = (p) => p._data?.Message ?? p._data?.message ?? {};

/** A poll's question and options, from whichever pollCreation version was used. */
export function pollOf(p) {
  const m = rawMessage(p);
  const c = m.pollCreationMessageV3 ?? m.pollCreationMessageV2 ?? m.pollCreationMessage ?? m.pollCreationMessageV5 ?? m.pollCreationMessageV4;
  if (!c?.name) return null;
  const options = (c.options ?? []).map((o) => o?.optionName).filter((o) => typeof o === "string");
  // selectableOptionsCount 1 = pick one; 0 = pick any number.
  return { name: c.name, options, multi: Number(c.selectableOptionsCount) !== 1 };
}

function messageType(p) {
  if (!p.hasMedia && pollOf(p)) return "poll";
  if (!p.hasMedia) return p.location ? "location" : p.vCards?.length ? "contacts" : "text";
  const mt = p.media?.mimetype ?? "";
  if (mt.startsWith("image/webp")) return "sticker";
  if (mt.startsWith("image/")) return "image";
  if (mt.startsWith("video/")) return "video";
  if (mt.startsWith("audio/")) return "audio";
  return "document";
}

/** Keep only the path of WAHA's file URL; the host is whatever WAHA_URL says. */
function mediaPath(url) {
  if (!url) return null;
  try {
    const path = new URL(url, "http://waha").pathname;
    return path.startsWith("/api/files/") ? path : null;
  } catch {
    return null;
  }
}

/** A location message's details, or null. A live location is marked as such. */
export function locationOf(p) {
  const l = p.location;
  if (!l) return null;
  const lat = Number(l.latitude), lng = Number(l.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const pick = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);
  return {
    lat, lng, live: !!l.live,
    name: pick(l.name), address: pick(l.address), description: pick(l.description),
    url: /^https?:\/\//.test(l.url ?? "") ? l.url : null,
  };
}

/**
 * What WhatsApp tells us about a document: size, page count and its own small
 * first-page preview. Read from the raw message GOWS forwards in `_data`.
 */
export function docMeta(p) {
  const m = p._data?.Message ?? p._data?.message ?? {};
  const d = m.documentMessage ?? m.documentWithCaptionMessage?.message?.documentMessage;
  if (!d) return null;
  const thumb = d.JPEGThumbnail ?? d.jpegThumbnail;
  const out = {
    size: Number(d.fileLength) || null,
    pages: Number(d.pageCount) || null,
    title: typeof d.title === "string" ? d.title : null,
    thumb: typeof thumb === "string" && thumb.length < 200_000 && /^[A-Za-z0-9+/=]+$/.test(thumb) ? thumb : null,
  };
  return Object.values(out).some((v) => v != null) ? out : null;
}

const ACK = { "-1": "failed", 0: "pending", 1: "sent", 2: "delivered", 3: "read", 4: "read" };

async function upsertLine(session, me, status) {
  const row = { id: session, updated_at: new Date().toISOString() };
  if (me?.id) row.phone = digits(me.id.split("@")[0]);
  if (me?.pushName) row.name = me.pushName;
  if (status) row.status = status;
  unwrap(await sb.from("wa_lines").upsert(row, { onConflict: "id" }), "upsertLine");
}

/**
 * The customer's chat id. Engines disagree on our own messages: GOWS puts the
 * chat in `from` and leaves `to` empty, WEBJS/NOWEB put us in `from` and the
 * chat in `to`. So for our messages take whichever side is not us.
 */
function chatIdOf(p, me) {
  if (!p.fromMe) return p.from;
  const mine = [me?.id, me?.lid].filter(Boolean).map((id) => digits(String(id).split("@")[0].split(":")[0]));
  return [p.to, p.from].find((id) => id && !mine.includes(digits(String(id).split("@")[0].split(":")[0])));
}

export async function storeMessage(session, p, me = null) {
  const chatId = chatIdOf(p, me);
  if (!isPersonalChat(chatId)) return null;
  const type = messageType(p);
  const loc = locationOf(p);
  const poll = pollOf(p);
  const text = p.body || p.media?.filename
    || (poll ? "📊 " + poll.name : "")
    || (loc ? (loc.live ? "📍 Live location" : "📍 " + (loc.name || loc.address || "Location")) + (loc.description ? " · " + loc.description : "") : "")
    || "";
  // Something WhatsApp sent that we do not render yet: say so, never a blank
  // bubble. Housekeeping (key shares, edits, deletes, poll votes, reactions)
  // is not a chat message at all and is skipped.
  let unsupported = null;
  if (!text && type === "text") {
    const kind = Object.keys(rawMessage(p)).find((k) => !NOT_CHAT.has(k));
    if (!kind) return null;
    unsupported = kind.replace(/Message(V\d+)?$/, "").replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
    console.log("waha unsupported message", kind);
  }
  const direction = p.fromMe ? "out" : "in";
  const at = p.timestamp ? new Date(p.timestamp * 1000).toISOString() : new Date().toISOString();
  const phone = await phoneFor(session, chatId, p._data);
  const name = direction === "in" ? (p._data?.Info?.PushName || p._data?.notifyName || null) : null;

  // Create the chat first so the message has somewhere to hang, without
  // touching its preview or unread count until the message is known to be new.
  const chat = unwrap(
    await sb.from("line_chats")
      .upsert({ line_id: session, chat_id: chatId }, { onConflict: "line_id,chat_id", ignoreDuplicates: false })
      .select("id").single(),
    "line chat"
  );
  const { error } = await sb.from("line_messages").insert({
    chat_id: chat.id,
    wa_message_id: p.id,
    direction,
    type: unsupported ? "unsupported" : type,
    body: text || (unsupported ? `Unsupported message: ${unsupported}` : null),
    has_media: !!p.hasMedia,
    mime_type: p.media?.mimetype ?? null,
    filename: p.media?.filename ?? null,
    media_url: mediaPath(p.media?.url),
    location: loc,
    meta: poll ? { poll, votes: {} } : docMeta(p),
    status: direction === "out" ? (ACK[p.ack] ?? "sent") : null,
    source: p.source === "api" ? "dashboard" : direction === "out" ? "phone" : null,
    wa_timestamp: at,
  });
  if (error?.code === "23505") return null; // a redelivery of a message we already have
  if (error) throw new Error(`line message: ${error.message}`);

  unwrap(await sb.rpc("touch_line_chat", {
    p_line: session, p_chat: chatId, p_phone: phone, p_name: name,
    p_text: text || `Unsupported message: ${unsupported}`, p_direction: direction, p_at: at, p_bump_unread: direction === "in",
  }), "touch_line_chat");
  return { chatId, direction };
}

/**
 * One person's vote on a poll. WhatsApp sends their full current selection
 * each time (empty when they take their vote back), so it replaces, not adds.
 */
async function storeVote(payload) {
  const pollId = payload?.poll?.id, v = payload?.vote;
  if (!pollId || !v) return;
  // The vote names the poll as fromMe_chat_ID, but its chat half can be the
  // phone JID while the poll was stored under the lid (or the reverse). The
  // WhatsApp message ID — the third part — is the same either way.
  const waId = String(pollId).split("_")[2];
  if (!waId) return;
  const rows = unwrap(
    await sb.from("line_messages").select("id, meta, wa_message_id").eq("type", "poll")
      .like("wa_message_id", `%\\_${waId}`).limit(2),
    "poll"
  );
  const row = rows.find((r) => r.wa_message_id.split("_")[2] === waId);
  if (!row?.meta?.poll) {
    console.warn("waha vote for unknown poll", pollId);
    return;
  }
  const voter = v.fromMe ? "me" : String(v.participant || v.from || "unknown");
  const votes = { ...(row.meta.votes ?? {}) };
  const picked = (v.selectedOptions ?? []).filter((o) => typeof o === "string");
  if (picked.length) votes[voter] = picked; else delete votes[voter];
  unwrap(await sb.from("line_messages").update({ meta: { ...row.meta, votes } }).eq("id", row.id), "poll vote");
}

async function storeAck(p) {
  const status = ACK[p.ack];
  if (!p.id || !status) return;
  unwrap(await sb.from("line_messages").update({ status }).eq("wa_message_id", p.id).eq("direction", "out"), "line ack");
}

/** Handle one WAHA webhook delivery. */
export async function ingestWaha(body) {
  const session = String(body?.session ?? "");
  if (!session) return { kind: "ignored" };
  const event = body.event;
  if (event === "session.status") {
    await upsertLine(session, body.me, body.payload?.status);
    return { kind: event };
  }
  // Keep the line's phone/name fresh from any event that carries them.
  if (body.me) await upsertLine(session, body.me);
  if (event === "message.any" || event === "message") {
    const r = await storeMessage(session, body.payload ?? {}, body.me);
    return { kind: event, stored: !!r };
  }
  if (event === "poll.vote") {
    await storeVote(body.payload);
    return { kind: event, stored: true };
  }
  if (event === "message.ack") {
    await storeAck(body.payload ?? {});
    return { kind: event };
  }
  return { kind: event ?? "unknown" };
}

// ---------------- dashboard ----------------

export async function listLines() {
  return unwrap(await sb.from("wa_lines").select("*").order("created_at"), "wa_lines");
}

export async function listLineChats(line) {
  return unwrap(
    await sb.from("line_chats").select("*").eq("line_id", line)
      .not("last_message_at", "is", null)
      .order("last_message_at", { ascending: false }).limit(300),
    "line_chats"
  );
}

export async function lineThread(line, chatId) {
  const chat = unwrap(
    await sb.from("line_chats").select("*").eq("line_id", line).eq("chat_id", chatId).maybeSingle(),
    "line chat"
  );
  if (!chat) return { chat: null, messages: [] };
  if (chat.unread) await sb.from("line_chats").update({ unread: 0 }).eq("id", chat.id);
  const rows = unwrap(
    await sb.from("line_messages").select("*").eq("chat_id", chat.id)
      .order("wa_timestamp", { ascending: true }).limit(500),
    "line_messages"
  );
  return {
    chat: { ...chat, unread: 0 },
    messages: rows.map((m) => ({
      id: m.id, direction: m.direction, type: m.type, text: m.body, status: m.status,
      source: m.source, filename: m.filename, timestamp: m.wa_timestamp,
      mime_type: m.mime_type, has_file: !!m.media_url, location: m.location ?? null, meta: m.meta ?? null,
    })),
  };
}

/**
 * The file behind a media message, fetched from WAHA with its API key so the
 * key never reaches the browser. Returns the upstream Response, or null.
 */
export async function lineMedia(line, messageId) {
  const row = unwrap(
    await sb.from("line_messages").select("media_url, mime_type, line_chats!inner(line_id)")
      .eq("id", messageId).eq("line_chats.line_id", line).maybeSingle(),
    "line media"
  );
  if (!row?.media_url) return null;
  const res = await fetch(`${wahaUrl()}${row.media_url}`, { headers: { "X-Api-Key": env("WAHA_API_KEY", "") } });
  if (!res.ok) return null;
  return { res, mime: row.mime_type || res.headers.get("content-type") || "application/octet-stream" };
}

/**
 * Send from the dashboard. WAHA echoes the message back as a message.any
 * event, which is what stores it — so it is recorded exactly once.
 */
export async function sendFromLine(line, chatId, text) {
  const chat = unwrap(
    await sb.from("line_chats").select("id").eq("line_id", line).eq("chat_id", chatId).maybeSingle(),
    "line chat"
  );
  if (!chat) throw new Error("no such chat");
  const r = await waha("/api/sendText", {
    method: "POST",
    body: JSON.stringify({ session: line, chatId, text }),
  });
  return { messageId: r?.id ?? null };
}
