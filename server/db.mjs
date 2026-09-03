// SQLite storage for leads, calls, WhatsApp threads and offers.
import Database from "better-sqlite3";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dir = dirname(fileURLToPath(import.meta.url));
export const db = new Database(process.env.DB_PATH ?? join(dir, "data.sqlite"));
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone10 TEXT UNIQUE NOT NULL,
  name TEXT,
  source TEXT,
  status TEXT DEFAULT 'new',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS calls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  attempt_id TEXT UNIQUE,
  phone10 TEXT NOT NULL,
  status TEXT DEFAULT 'dispatched',
  duration REAL,
  transcript TEXT,
  variables TEXT,
  failure_reason TEXT,
  interaction_id TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT
);
CREATE TABLE IF NOT EXISTS wa_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone10 TEXT NOT NULL,
  direction TEXT NOT NULL,          -- 'in' | 'out'
  type TEXT DEFAULT 'text',
  text TEXT,
  caption TEXT,
  media_id TEXT,
  mime_type TEXT,
  filename TEXT,
  button_payload TEXT,
  message_id TEXT,
  status TEXT,                      -- sent/delivered/read/failed (outbound)
  source TEXT,                      -- reply | agent | voice-agent | automation
  timestamp TEXT DEFAULT (datetime('now')),
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_wa_messages_phone ON wa_messages(phone10, id);
CREATE TABLE IF NOT EXISTS wa_conversations (
  phone10 TEXT PRIMARY KEY,
  contact_name TEXT,
  last_message_at TEXT,
  last_message_text TEXT,
  last_direction TEXT,
  unread INTEGER DEFAULT 0,
  window_open_until TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS wa_events_raw (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT,
  payload TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS offers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  pitch TEXT NOT NULL,
  goal TEXT,
  active INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now'))
);
`);

export function upsertLead(phone10, fields = {}) {
  db.prepare(
    `INSERT INTO leads (phone10, name, source) VALUES (?, ?, ?)
     ON CONFLICT(phone10) DO UPDATE SET
       name = COALESCE(excluded.name, leads.name),
       source = COALESCE(excluded.source, leads.source),
       updated_at = datetime('now')`
  ).run(phone10, fields.name ?? null, fields.source ?? null);
  if (fields.status) {
    db.prepare(`UPDATE leads SET status = ?, updated_at = datetime('now') WHERE phone10 = ?`).run(fields.status, phone10);
  }
  return db.prepare(`SELECT * FROM leads WHERE phone10 = ?`).get(phone10);
}

export function touchConversation(phone10, { text, direction, contactName, openWindow, bumpUnread }) {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO wa_conversations (phone10, contact_name, last_message_at, last_message_text, last_direction, unread, window_open_until, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(phone10) DO UPDATE SET
       contact_name = COALESCE(excluded.contact_name, wa_conversations.contact_name),
       last_message_at = excluded.last_message_at,
       last_message_text = excluded.last_message_text,
       last_direction = excluded.last_direction,
       unread = CASE WHEN ? THEN wa_conversations.unread + 1 ELSE wa_conversations.unread END,
       window_open_until = COALESCE(excluded.window_open_until, wa_conversations.window_open_until),
       updated_at = datetime('now')`
  ).run(
    phone10,
    contactName ?? null,
    now,
    text ?? "",
    direction,
    bumpUnread ? 1 : 0,
    openWindow ? new Date(Date.now() + 24 * 3600 * 1000).toISOString() : null,
    bumpUnread ? 1 : 0
  );
}

export function windowOpen(phone10) {
  const row = db.prepare(`SELECT window_open_until FROM wa_conversations WHERE phone10 = ?`).get(phone10);
  return !!(row?.window_open_until && new Date(row.window_open_until).getTime() > Date.now());
}
