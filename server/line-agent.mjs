// AI replies on linked numbers (WAHA), for the chats someone switched it on.
//
// Separate from agent/whatsapp-agent.mjs on purpose: that agent is built
// around the BSP inbox (phone10 threads, the 24-hour window, templates, lead
// tools). Here the job is narrower — answer one customer from one linked
// number, from the Marketing Ravan playbook, or hand the chat to a person.
//
// Safety rails, in order of importance:
// - Off unless a person enabled it on that chat (line_chats.ai_enabled).
// - A person replying from the dashboard or the phone pauses it.
// - Bursts of messages are answered once, after the customer stops typing.
// - Looks like a person: seen, typing…, a pause proportional to the reply.
// - A daily cap across all linked numbers (LINE_AI_PER_DAY, default 300).
import { sb, unwrap } from "./db.mjs";
import { activePlaybook, currentOffer, playbookText } from "./agent/prompt.mjs";
import { productionModel } from "./agent/models.mjs";

const env = (k, d) => process.env[k] ?? d;
const wahaUrl = () => String(env("WAHA_URL", "http://127.0.0.1:3300")).replace(/\/+$/, "");
const QUIET_MS = Number(env("LINE_AI_QUIET_MS", 6000));   // wait for the customer to stop typing
const HISTORY = 16;
const DAILY_CAP = Number(env("LINE_AI_PER_DAY", 300));
const TEXTUAL = new Set(["text", "location", "poll"]);

async function waha(path, body) {
  const res = await fetch(`${wahaUrl()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Key": env("WAHA_API_KEY", "") },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || `WAHA ${res.status}`);
  return data;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------- telling our own sends apart ----------------
//
// WAHA echoes everything we send as message.any with source "api" — the
// dashboard's replies and the AI's alike. The AI's must not count as "a
// person replied", so remember what the AI is sending, by message id and,
// for an echo that beats sendText's response, by chat for a few seconds.
const aiIds = new Set();
const aiSendingUntil = new Map(); // chat_id -> epoch ms

export function isAiEcho(chatId, waMessageId) {
  if (waMessageId && aiIds.has(waMessageId)) return true;
  return (aiSendingUntil.get(chatId) ?? 0) > Date.now();
}

// ---------------- daily cap ----------------
let day = { key: "", n: 0 };
function takeBudget() {
  const key = new Date().toISOString().slice(0, 10);
  if (day.key !== key) day = { key, n: 0 };
  if (day.n >= DAILY_CAP) return false;
  day.n++;
  return true;
}

// ---------------- the prompt ----------------

function brand(line) {
  const who = line?.name ? `${line.name} at Marketing Ravan` : "Marketing Ravan";
  return `You reply to WhatsApp messages on behalf of ${who}, an AI marketing agency in India (WhatsApp AI agents, voice agents, websites, ads, automation). The customer sees your message as coming from this person's WhatsApp number.

How you reply:
- Warm, direct and brief — this is a chat. One to three short sentences. No bullet lists unless they ask for options, no email sign-offs, no "As an AI".
- Mirror the customer's language and script exactly: Hindi in Devanagari, Hinglish in Latin script, English in English.
- Any claim about pricing, deliverables, timelines, guarantees or terms must come from THE PLAYBOOK below. If it is not there, say you will confirm with the team and get back — never estimate or invent a number.
- Move the conversation forward: understand what they sell and what they want, and suggest the next step (a call, a demo, sharing details).
- Never claim something was done (a call booked, a message sent, a payment received) — you cannot do those things.
- Hand the chat to a person instead of replying when: they are upset or complaining, ask for a refund or anything legal/payment-related, ask for a human, the message is clearly personal (friends, family, not about business), or you cannot tell what they want.

Answer with JSON only: {"reply": "<the message to send, or empty>", "handoff": <true|false>, "reason": "<why, when handoff is true>"}.
When handoff is true, reply must be empty.`;
}

function transcript(rows) {
  // Gemini wants alternating turns ending on the customer; merge runs.
  const turns = [];
  for (const m of rows) {
    const role = m.direction === "in" ? "user" : "model";
    const text = m.body || `[${m.type}]`;
    const last = turns[turns.length - 1];
    if (last?.role === role) last.parts[0].text += `\n${text}`;
    else turns.push({ role, parts: [{ text }] });
  }
  while (turns.length && turns[0].role !== "user") turns.shift();
  return turns;
}

async function askGemini(system, contents) {
  const model = env("LINE_AI_MODEL", productionModel());
  const key = env("GOOGLE_GENERATIVE_AI_API_KEY") ?? env("GOOGLE_API_KEY");
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents,
      generationConfig: {
        temperature: 0.6,
        maxOutputTokens: 400,
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: { reply: { type: "STRING" }, handoff: { type: "BOOLEAN" }, reason: { type: "STRING" } },
          required: ["reply", "handoff"],
        },
      },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `Gemini ${res.status}`);
  const raw = data?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  const out = JSON.parse(raw);
  return { reply: String(out.reply ?? "").trim(), handoff: !!out.handoff, reason: out.reason ?? null, model, usage: data.usageMetadata ?? null };
}

// ---------------- the turn ----------------

/**
 * What the AI would say next in this chat — nothing is sent. The turn below
 * uses it, and so can a dry run from the command line.
 */
export async function draft(session, chat, rows) {
  const [line, rules, offer] = await Promise.all([
    sb.from("wa_lines").select("name").eq("id", session).maybeSingle().then((r) => r.data),
    activePlaybook(),
    currentOffer(),
  ]);
  const system = [
    brand(line),
    rules.length ? playbookText(rules) : "THE PLAYBOOK is empty — confirm every fact with the team.",
    offer ? `Current offer — mention it when it fits naturally.\nName: ${offer.name}\nPitch: ${offer.pitch}${offer.goal ? `\nGoal: ${offer.goal}` : ""}` : "",
    `${chat.contact_name ? `The customer's WhatsApp name is ${chat.contact_name}. ` : ""}It is ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST.`,
  ].filter(Boolean).join("\n\n");

  return askGemini(system, transcript(rows));
}


async function flagHuman(chatRowId, reason) {
  await sb.from("line_chats").update({
    needs_human: true, handoff_reason: reason, handoff_at: new Date().toISOString(),
  }).eq("id", chatRowId);
}

async function replyTurn(session, chatId) {
  const chat = unwrap(
    await sb.from("line_chats").select("*").eq("line_id", session).eq("chat_id", chatId).maybeSingle(),
    "line chat"
  );
  if (!chat?.ai_enabled) return;
  const rows = unwrap(
    await sb.from("line_messages").select("direction, type, body, wa_timestamp").eq("chat_id", chat.id)
      .order("wa_timestamp", { ascending: false }).limit(HISTORY),
    "history"
  ).reverse();
  const last = rows[rows.length - 1];
  if (!last || last.direction !== "in") return; // someone already answered
  if (!TEXTUAL.has(last.type)) {
    await flagHuman(chat.id, `sent a ${last.type} — the AI only answers text`);
    console.log("line-ai handoff (media)", session, chatId, last.type);
    return;
  }
  if (!takeBudget()) {
    await flagHuman(chat.id, "AI daily limit reached");
    console.warn("line-ai daily cap reached");
    return;
  }

  const out = await draft(session, chat, rows);
  console.log("line-ai", session, chatId, out.handoff ? `handoff: ${out.reason}` : `reply ${out.reply.length} chars`, out.model, out.usage?.totalTokenCount ?? "");
  if (out.handoff || !out.reply) {
    await flagHuman(chat.id, out.reason || "the AI chose not to answer");
    return;
  }

  // Still ours to answer? A person may have replied, or switched it off,
  // while the model was thinking.
  const now = unwrap(await sb.from("line_chats").select("ai_enabled, last_direction").eq("id", chat.id).single(), "recheck");
  if (!now.ai_enabled || now.last_direction !== "in") return;

  aiSendingUntil.set(chatId, Date.now() + 30_000);
  try {
    await waha("/api/sendSeen", { session, chatId }).catch(() => {});
    await waha("/api/startTyping", { session, chatId }).catch(() => {});
    await sleep(Math.min(7000, 1500 + out.reply.length * 35));
    await waha("/api/stopTyping", { session, chatId }).catch(() => {});
    const sent = await waha("/api/sendText", { session, chatId, text: out.reply });
    if (sent?.id) {
      aiIds.add(sent.id);
      setTimeout(() => aiIds.delete(sent.id), 10 * 60_000).unref?.();
      // The echo may already be stored (as "dashboard") — label it.
      await sb.from("line_messages").update({ source: "ai" }).eq("wa_message_id", sent.id);
    }
  } finally {
    setTimeout(() => aiSendingUntil.delete(chatId), 5000).unref?.();
  }
}

// One pending turn per chat: every new message restarts the quiet timer, so a
// customer who sends four lines in a row gets one answer to all four.
const timers = new Map();
const running = new Set();

export function scheduleReply(session, chatId) {
  const key = `${session}|${chatId}`;
  clearTimeout(timers.get(key));
  timers.set(key, setTimeout(async () => {
    timers.delete(key);
    if (running.has(key)) { scheduleReply(session, chatId); return; }
    running.add(key);
    try { await replyTurn(session, chatId); }
    catch (e) { console.error("line-ai error", session, chatId, e.message); }
    finally { running.delete(key); }
  }, QUIET_MS));
}
