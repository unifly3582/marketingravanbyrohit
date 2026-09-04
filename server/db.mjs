// Supabase (Postgres) storage for leads, calls, WhatsApp threads, offers and
// agent traces.
//
// This is the only data store. It replaced a local better-sqlite3 file, which
// bought two things: the browser can subscribe to the same rows over Realtime,
// and state survives a redeploy. An existing server still holding a data.sqlite
// is migrated with `node migrate-sqlite.mjs --apply`.
//
// Uses the service-role key: this module runs server-side only and deliberately
// bypasses RLS. Never import it from anything that ships to a browser.
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

export const sb = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Throw on error, otherwise hand back the data. Keeps call sites terse. */
export function unwrap({ data, error }, context) {
  if (error) throw new Error(`${context}: ${error.message}`);
  return data;
}

// ---------------- leads ----------------

export async function upsertLead(phone10, fields = {}) {
  return unwrap(
    await sb.rpc("upsert_lead", {
      p_phone10: phone10,
      p_name: fields.name ?? null,
      p_source: fields.source ?? null,
      p_status: fields.status ?? null,
    }),
    "upsertLead"
  );
}

// ---------------- conversations ----------------

export async function touchConversation(phone10, opts = {}) {
  const call = () => sb.rpc("touch_conversation", {
    p_phone10: phone10,
    p_text: opts.text ?? "",
    p_direction: opts.direction ?? null,
    p_contact_name: opts.contactName ?? null,
    p_open_window: !!opts.openWindow,
    p_bump_unread: !!opts.bumpUnread,
  });
  let r = await call();
  // Two webhook deliveries for a brand-new number can race to create the row:
  // the RPC upserts on phone10, but the loser trips the separate wa_id unique
  // key first. On the retry the row exists and the upsert path applies.
  if (r.error?.code === "23505") r = await call();
  return unwrap(r, "touchConversation");
}

/** Conversation id for a phone number, creating a bare thread if needed. */
export async function conversationId(phone10, contactName = null) {
  const existing = unwrap(
    await sb.from("conversations").select("id").eq("phone10", phone10).maybeSingle(),
    "conversationId"
  );
  if (existing) return existing.id;
  const created = await touchConversation(phone10, { contactName, text: "", direction: null });
  return created.id;
}

export async function windowOpen(phone10) {
  const row = unwrap(
    await sb.from("conversations").select("window_open_until").eq("phone10", phone10).maybeSingle(),
    "windowOpen"
  );
  return !!(row?.window_open_until && new Date(row.window_open_until).getTime() > Date.now());
}

export async function clearUnread(phone10) {
  unwrap(await sb.from("conversations").update({ unread: 0 }).eq("phone10", phone10), "clearUnread");
}

// ---------------- messages ----------------

export async function insertMessage(phone10, fields) {
  const convId = await conversationId(phone10, fields.contactName ?? null);
  const row = {
    conversation_id: convId,
    direction: fields.direction,
    role: fields.direction === "in" ? "user" : "assistant",
    type: fields.type ?? "text",
    body: fields.text ?? null,
    caption: fields.caption ?? null,
    media_id: fields.mediaId ?? null,
    mime_type: fields.mimeType ?? null,
    filename: fields.filename ?? null,
    button_payload: fields.buttonPayload ?? null,
    wa_message_id: fields.messageId ?? null,
    status: fields.status ?? null,
    source: fields.source ?? null,
    wa_timestamp: fields.timestamp ?? new Date().toISOString(),
  };
  // Duplicate webhook deliveries are normal; ignore the unique-violation replay.
  const { data, error } = await sb.from("messages").insert(row).select().maybeSingle();
  if (error && error.code !== "23505") throw new Error(`insertMessage: ${error.message}`);
  return data ?? null;
}

export async function updateMessageStatus(waMessageId, status) {
  unwrap(
    await sb.from("messages").update({ status }).eq("wa_message_id", waMessageId),
    "updateMessageStatus"
  );
}

export async function recentMessages(phone10, limit = 20) {
  const convId = await conversationId(phone10);
  const rows = unwrap(
    await sb
      .from("messages")
      .select("direction, role, body, type, created_at")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: false })
      .limit(limit),
    "recentMessages"
  );
  return rows.reverse();
}

export async function logRawEvent(kind, payload) {
  const { error } = await sb.from("wa_events_raw").insert({ kind, payload });
  if (error) console.error("logRawEvent:", error.message); // never block ingestion
}

// ---------------- calls ----------------

export async function recordCall(phone10, attemptId, source = "website") {
  const lead = await upsertLead(phone10, { status: "called", source });
  return unwrap(
    await sb
      .from("calls")
      .insert({ attempt_id: attemptId, phone10, lead_id: lead?.id ?? null, source })
      .select()
      .maybeSingle(),
    "recordCall"
  );
}

export async function completeCall(attemptId, payload) {
  unwrap(
    await sb
      .from("calls")
      .update({
        status: payload.status ?? "unknown",
        duration: payload.duration ?? null,
        transcript: payload.interaction_transcript ?? null,
        variables: payload.final_agent_variables ?? null,
        failure_reason: payload.failure_reason ?? null,
        interaction_id: payload.interaction_id ?? null,
        completed_at: new Date().toISOString(),
      })
      .eq("attempt_id", attemptId),
    "completeCall"
  );
}

// ---------------- offers ----------------

export async function activeOffer() {
  return unwrap(
    await sb.from("offers").select("*").eq("active", true).limit(1).maybeSingle(),
    "activeOffer"
  );
}

/** Every active playbook rule, for inlining into a prompt. Vectors excluded. */
export async function activePolicies() {
  const { data, error } = await sb
    .from("policies")
    .select("title, rule, category")
    .eq("active", true)
    .order("category")
    .order("title");
  if (error) throw new Error(`activePolicies: ${error.message}`);
  return data ?? [];
}
