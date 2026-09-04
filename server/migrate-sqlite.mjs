// One-shot migration: the old better-sqlite3 store → Supabase.
//
//   node migrate-sqlite.mjs                    # dry run against ./data.sqlite
//   node migrate-sqlite.mjs --apply            # actually write
//   node migrate-sqlite.mjs /path/db --apply   # explicit file
//
// The codebase moved to Supabase, but a server that has been running still has
// a data.sqlite full of real leads, calls and WhatsApp threads. Deploying the
// new code does not move that data — it just stops reading it. Run this on the
// VPS before or after the deploy, then keep the .sqlite as a cold backup.
//
// Reads via node:sqlite, built into Node 22, so nothing has to be installed on
// the server just to migrate off SQLite.
//
// Safe to re-run: every write is an upsert on a natural key (phone10,
// attempt_id, message_id), so a partial run can simply be repeated.

import "./env.mjs";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const { sb } = await import("./db.mjs");

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const dbPath = resolve(
  args.find((a) => !a.startsWith("--")) ??
    process.env.DB_PATH ??
    join(dirname(fileURLToPath(import.meta.url)), "data.sqlite")
);

if (!existsSync(dbPath)) {
  console.error(`No SQLite file at ${dbPath}`);
  console.error("Nothing to migrate — pass the path explicitly if it lives elsewhere.");
  process.exit(1);
}

console.log(`source : ${dbPath}`);
console.log(`mode   : ${APPLY ? "APPLY — writing to Supabase" : "dry run (pass --apply to write)"}\n`);

const db = new DatabaseSync(dbPath, { readOnly: true });

const tables = new Set(
  db.prepare("select name from sqlite_master where type='table'").all().map((r) => r.name)
);
const rows = (t) => (tables.has(t) ? db.prepare(`select * from ${t}`).all() : []);

/** SQLite datetime('now') yields "YYYY-MM-DD HH:MM:SS" in UTC, with no zone. */
function ts(v) {
  if (!v) return null;
  const s = String(v);
  if (s.includes("T")) return s; // already ISO
  return s.replace(" ", "T") + "Z";
}
const json = (v) => {
  if (v == null) return null;
  if (typeof v === "object") return v;
  try { return JSON.parse(v); } catch { return null; }
};

/** Upsert in chunks; returns how many rows were sent. */
async function push(table, list, onConflict) {
  if (!list.length) return 0;
  if (!APPLY) return list.length;
  let done = 0;
  for (let i = 0; i < list.length; i += 200) {
    const chunk = list.slice(i, i + 200);
    const { error } = await sb.from(table).upsert(chunk, { onConflict, ignoreDuplicates: false });
    if (error) throw new Error(`${table}: ${error.message}`);
    done += chunk.length;
  }
  return done;
}

const report = [];
const log = async (label, n) => report.push(`  ${String(n).padStart(5)}  ${label}`);

// ---- leads -----------------------------------------------------------------
const leads = rows("leads").filter((l) => l.phone10);
await log("leads", await push("leads", leads.map((l) => ({
  phone10: l.phone10,
  name: l.name ?? null,
  source: l.source ?? "website",
  status: l.status ?? "new",
  phone: `+91${l.phone10}`,
  created_at: ts(l.created_at) ?? new Date().toISOString(),
  updated_at: ts(l.updated_at) ?? new Date().toISOString(),
})), "phone10"));

// Map phone10 → lead uuid so calls can carry their foreign key.
const leadIds = new Map();
if (APPLY && leads.length) {
  const { data } = await sb.from("leads").select("id, phone10").not("phone10", "is", null);
  for (const r of data ?? []) leadIds.set(r.phone10, r.id);
}

// ---- calls -----------------------------------------------------------------
const calls = rows("calls").filter((c) => c.attempt_id);
await log("calls", await push("calls", calls.map((c) => ({
  attempt_id: c.attempt_id,
  interaction_id: c.interaction_id ?? null,
  phone10: c.phone10,
  lead_id: leadIds.get(c.phone10) ?? null,
  status: c.status ?? "unknown",
  duration: c.duration ?? null,
  transcript: json(c.transcript),
  variables: json(c.variables),
  failure_reason: c.failure_reason ?? null,
  source: "migrated",
  created_at: ts(c.created_at) ?? new Date().toISOString(),
  completed_at: ts(c.completed_at),
})), "attempt_id"));

// ---- conversations (must precede messages: FK) -----------------------------
const convs = rows("wa_conversations").filter((c) => c.phone10);

// An old store can hold messages whose wa_conversations row was pruned. The FK
// would reject those messages, so synthesise the missing threads rather than
// dropping real customer history on the floor.
const convPhones = new Set(convs.map((c) => c.phone10));
const strandedPhones = [
  ...new Set(rows("wa_messages").map((m) => m.phone10).filter((p) => p && !convPhones.has(p))),
];
for (const phone10 of strandedPhones) {
  convs.push({ phone10, contact_name: null, last_direction: null, unread: 0 });
}
if (strandedPhones.length) {
  report.push(`  ${String(strandedPhones.length).padStart(5)}  conversations rebuilt from orphaned messages`);
}

await log("conversations", await push("conversations", convs.map((c) => ({
  phone10: c.phone10,
  wa_id: c.phone10,
  channel: "whatsapp",
  contact_name: c.contact_name ?? null,
  contact_phone: `+91${c.phone10}`,
  last_message_at: ts(c.last_message_at),
  last_message_text: c.last_message_text ?? null,
  last_direction: c.last_direction ?? null,
  unread: c.unread ?? 0,
  window_open_until: ts(c.window_open_until),
  updated_at: ts(c.updated_at) ?? new Date().toISOString(),
})), "phone10"));

// ---- messages --------------------------------------------------------------
const convIds = new Map();
if (APPLY && convs.length) {
  const { data } = await sb.from("conversations").select("id, phone10").not("phone10", "is", null);
  for (const r of data ?? []) convIds.set(r.phone10, r.id);
}

const msgs = rows("wa_messages");
// A message with no conversation would violate the FK — count them separately
// rather than failing the whole run.
const placeable = APPLY ? msgs.filter((m) => convIds.has(m.phone10)) : msgs;
const orphans = msgs.length - placeable.length;

await log("messages", await push("messages", placeable.map((m) => ({
  conversation_id: convIds.get(m.phone10),
  direction: m.direction,
  role: m.direction === "in" ? "user" : "assistant",
  type: m.type ?? "text",
  body: m.text ?? null,
  caption: m.caption ?? null,
  media_id: m.media_id ?? null,
  mime_type: m.mime_type ?? null,
  filename: m.filename ?? null,
  button_payload: m.button_payload ?? null,
  wa_message_id: m.message_id ?? null,
  status: m.status ?? null,
  source: m.source ?? "migrated",
  wa_timestamp: ts(m.timestamp),
  created_at: ts(m.created_at) ?? new Date().toISOString(),
})), "wa_message_id"));

// ---- offers ----------------------------------------------------------------
const offers = rows("offers");
await log("offers", await push("offers", offers.map((o) => ({
  name: o.name,
  pitch: o.pitch,
  goal: o.goal ?? null,
  active: !!o.active,
  updated_at: ts(o.updated_at) ?? new Date().toISOString(),
})), "name"));

// ---- raw webhook log (optional, can be large) -------------------------------
const raw = rows("wa_events_raw");
if (args.includes("--with-raw")) {
  await log("wa_events_raw", await push("wa_events_raw", raw.map((e) => ({
    kind: e.kind,
    payload: json(e.payload) ?? { unparsed: String(e.payload ?? "") },
    created_at: ts(e.created_at) ?? new Date().toISOString(),
  }))));
} else if (raw.length) {
  report.push(`  ${String(raw.length).padStart(5)}  wa_events_raw (skipped — pass --with-raw)`);
}

db.close();

console.log(APPLY ? "migrated:" : "would migrate:");
console.log(report.join("\n"));
if (orphans) {
  console.log(`\n  ${orphans} message(s) had no matching conversation and were skipped.`);
}
if (!APPLY) {
  console.log("\nDry run only. Re-run with --apply to write.");
} else {
  console.log("\nDone. Keep the .sqlite file as a cold backup — do not delete it yet.");
}
