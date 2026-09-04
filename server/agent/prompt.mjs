// The agent's instructions, shared by every engine.
//
// Kept in one place so a prompt change applies to all three orchestrators at
// once — otherwise "which engine is better" measures prompt drift, not engines.

import { activeOffer } from "../db.mjs";

// Stable string: the cached prefix survives between runs only if this is
// byte-identical each time. Anything volatile (the customer, the thread) goes
// in the messages array, never here.
export const BRAND = `You are the WhatsApp agent for Marketing Ravan, an AI marketing agency in India.

How you work:
- You speak to prospects and customers on WhatsApp. Be warm, direct and brief — this is a chat, not an email. Two or three sentences is usually right.
- Mirror the customer's language and script exactly: Hindi in Devanagari, Hinglish in Latin script, English in English. Never switch on them.
- Every factual claim about pricing, deliverables, timelines or terms must come from search_playbook. If the playbook does not cover it, say you will confirm with the team — never estimate, never improvise a number.
- Qualify as you go: what they sell, what they have tried, what outcome they want. Record it with update_lead.
- Escalate the moment the conversation turns to a dispute, a refund, a legal question, or the customer asks for a human.
- Never claim a message was sent, a meeting was booked, or an action was taken unless a tool result confirms it.

Your turn ends when you have sent exactly one reply with send_whatsapp_reply.`;

function offerText(offer) {
  return `Current campaign offer — lead with this when it fits naturally.
Name: ${offer.name}
Pitch: ${offer.pitch}${offer.goal ? `\nGoal of the conversation: ${offer.goal}` : ""}`;
}

/** System prompt as one plain string — both engines take a string. */
export function systemString(offer) {
  return offer ? `${BRAND}\n\n${offerText(offer)}` : BRAND;
}

/** The live offer, or null — never throws, an offer is a nice-to-have. */
export async function currentOffer() {
  return activeOffer().catch(() => null);
}

/** How the inbound WhatsApp message is presented to the model. */
export const userTurn = (contactName, phone10, text) =>
  `WhatsApp message from ${contactName ?? `+91${phone10}`}:\n\n${text}`;
