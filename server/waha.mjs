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

function messageType(p) {
  if (!p.hasMedia) return p.location ? "location" : p.vCards?.length ? "contacts" : "text";
  const mt = p.media?.mimetype ?? "";
  if (mt.startsWith("image/webp")) return "sticker";
  if (mt.startsWith("image/")) return "image";
  if (mt.startsWith("video/")) return "video";
  if (mt.startsWith("audio/")) return "audio";
  return "document";
}

const ACK = { "-1": "failed", 0: "pending", 1: "sent", 2: "delivered", 3: "read", 4: "read" };

async function upsertLine(session, me, status) {
  const row = { id: session, updated_at: new Date().toISOString() };
  if (me?.id) row.phone = digits(me.id.split("@")[0]);
  if (me?.pushName) row.name = me.pushName;
  if (status) row.status = status;
  unwrap(await sb.from("wa_lines").upsert(row, { onConflict: "id" }), "upsertLine");
}

async function storeMessage(session, p) {
  // For our own messages the conversation partner is the recipient.
  const chatId = p.fromMe ? p.to : p.from;
  if (!isPersonalChat(chatId)) return null;
  const type = messageType(p);
  const text = p.body || p.media?.filename || (p.location ? [p.location.description, `${p.location.latitude},${p.location.longitude}`].filter(Boolean).join(" ") : "") || "";
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
    type,
    body: text || null,
    has_media: !!p.hasMedia,
    mime_type: p.media?.mimetype ?? null,
    filename: p.media?.filename ?? null,
    status: direction === "out" ? (ACK[p.ack] ?? "sent") : null,
    source: p.source === "api" ? "dashboard" : direction === "out" ? "phone" : null,
    wa_timestamp: at,
  });
  if (error?.code === "23505") return null; // a redelivery of a message we already have
  if (error) throw new Error(`line message: ${error.message}`);

  unwrap(await sb.rpc("touch_line_chat", {
    p_line: session, p_chat: chatId, p_phone: phone, p_name: name,
    p_text: text || `[${type}]`, p_direction: direction, p_at: at, p_bump_unread: direction === "in",
  }), "touch_line_chat");
  return { chatId, direction };
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
    const r = await storeMessage(session, body.payload ?? {});
    return { kind: event, stored: !!r };
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
    })),
  };
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
