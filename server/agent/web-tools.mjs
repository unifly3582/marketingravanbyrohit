// Tools the website voice agent can call, on top of the shared ones.
//
// The shared set (search_playbook, update_lead, get_conversation_history,
// escalate_to_human) comes straight from tools.mjs, so a browser conversation
// hits the same playbook, writes the same lead row and lands on the same trace
// as WhatsApp and the phone line. What is added here is everything that only
// makes sense when the customer is looking at a web page:
//
//   navigate_site          drive the visitor's browser to the page being discussed
//   offer_choices          put tappable answers under the agent's question
//   capture_contact        turn an anonymous visitor into a lead mid-sentence
//   request_callback       hand off to the outbound phone agent
//   send_whatsapp_message  send them something on WhatsApp, in their words
//   escalate_to_human      flag the thread for a person — or, for an anonymous
//                          visitor, open the WhatsApp handoff form in the panel
//   end_session            close the session politely
//
// navigate_site is the point of the whole feature. Everything else the agent
// says could be said on the phone; making the page move while it talks is the
// thing a visitor cannot get anywhere else, and it is also the honest demo —
// a prospect watching an agent operate a UI understands the product in a way
// no case study achieves.
//
// The identity object is shared with the session and mutated by
// capture_contact: a visitor arrives anonymous, and every phone-shaped tool
// resolves who they are at call time rather than at build time.

import { z } from "zod";
import { upsertLead, conversationId, touchConversation, recentMessages, flagHandoff, conversationByPhone } from "../db.mjs";
import { phone10 as normalizePhone, sendMessage } from "../wa.mjs";

/** How much of an existing thread the agent is shown when a returning visitor gives their number. */
const HISTORY_ON_CAPTURE = 8;

/** Where the agent is allowed to send the browser. Anything else is refused. */
export const SITE_MAP = [
  { path: "/", label: "Home", about: "The agency overview and the ten heads." },
  { path: "/heads/sdr", label: "WhatsApp agents for sales & support", about: "AI agents that answer, qualify and book on WhatsApp." },
  { path: "/heads/voice", label: "Voice agents", about: "Voice agents that pick up every call and never miss a lead." },
  { path: "/heads/agents", label: "AI agents for everyday business tasks", about: "Multi-step AI agents and workflow automation across your apps." },
  { path: "/heads/ecom", label: "Agents for online stores", about: "Agents that run and grow an e-commerce store." },
  { path: "/heads/erp", label: "Invoices, stock & accounts by AI", about: "OCR from invoices straight into the ledger, stock and accounts." },
  { path: "/heads/ads", label: "Facebook & Instagram ads", about: "Paid social campaigns that bring buyers." },
  { path: "/heads/social", label: "Social media, managed daily", about: "Content and posting handled every day." },
  { path: "/heads/campaign", label: "Google, YouTube & email campaigns", about: "Full-funnel campaigns." },
  { path: "/heads/geo", label: "GEO & SEO", about: "Ranking on Google, ChatGPT and Perplexity." },
  { path: "/heads/uiux", label: "Websites & product design", about: "Websites that turn visitors into customers." },
  { path: "/works", label: "Work", about: "Case studies and shipped projects." },
  { path: "/pricing", label: "Pricing", about: "Packages and what they include." },
  { path: "/about", label: "About", about: "Who we are." },
  { path: "/blog", label: "Blog", about: "Writing." },
  { path: "/contact", label: "Contact", about: "The contact form and direct channels." },
  { path: "/live", label: "Live agent workflows", about: "Watch a real agent run, step by step, in a graph." },
];

const PATHS = SITE_MAP.map((p) => p.path);

/**
 * Web-only tool specs.
 *
 * @param {object} ctx
 * @param {object} ctx.tracer
 * @param {object} ctx.identity        { phone10, name, email } — mutated in place
 * @param {object} ctx.outcome         { navigatedTo, endSession, ... } — mutated in place
 * @param {(msg: object) => void} ctx.emit  push an event to the visitor's browser
 * @param {(p10: string, opts: object) => Promise<string>} ctx.dialOut  outbound call placer
 * @param {boolean} [ctx.demo]         simulate side effects
 */
export function buildWebToolSpecs({ tracer, identity, outcome, emit, dialOut, demo = false }) {
  const traced = (node, label, fn) => async (input) => {
    const step = await tracer.step(node, { kind: "tool", label, input });
    try {
      const output = await fn(input);
      await step.ok(output);
      return output;
    } catch (err) {
      await step.fail(err);
      return { error: String(err.message ?? err) };
    }
  };

  return [
    {
      name: "navigate_site",
      node: "navigate",
      label: "Navigate the site",
      description:
        "Move the visitor's browser to a page on marketingravan.com while you keep talking. " +
        "Use it whenever the page would show what you are describing — a service they asked " +
        "about, pricing, the work, the contact form. Say what you are doing as you do it " +
        "('let me open that for you'), and keep talking; the page changes under them, so do " +
        "not go silent. Allowed paths only:\n" +
        SITE_MAP.map((p) => `  ${p.path} — ${p.label}: ${p.about}`).join("\n"),
      schema: z.object({
        path: z.string().describe("One of the allowed paths, exactly as written"),
        reason: z.string().describe("One short phrase on why, shown to the visitor"),
      }),
      run: traced("navigate", "Navigate the site", async ({ path, reason }) => {
        // A hallucinated path would 404 the visitor mid-sentence, so an unknown
        // one is refused with the list rather than followed.
        if (!PATHS.includes(path)) {
          return {
            navigated: false,
            error: `"${path}" is not a page on this site. Choose one of: ${PATHS.join(", ")}`,
          };
        }
        outcome.navigatedTo = path;
        emit({ type: "navigate", path, reason });
        return { navigated: true, path, reason };
      }),
    },

    {
      name: "offer_choices",
      node: "choices",
      label: "Offer choices",
      description:
        "Show two to six tappable answers under what you just said. The visitor taps one and " +
        "it arrives as their reply, exactly as written. Use it every time a question has a " +
        "small set of likely answers — what kind of business, how leads reach them, which " +
        "service, where to send something. Keep each option under six words. Ask the question " +
        "out loud first, then call this; never read the options aloud one by one. A typed or " +
        "spoken answer that is not on the list is fine too.",
      schema: z.object({
        options: z.array(z.string().max(48)).min(2).max(6).describe("The answers, in the visitor's language"),
        prompt: z.string().max(120).optional().describe("Optional short label above the options"),
      }),
      run: traced("choices", "Offer choices", async ({ options, prompt }) => {
        const clean = [...new Set(options.map((o) => o.trim()).filter(Boolean))].slice(0, 6);
        if (clean.length < 2) return { shown: false, error: "Need at least two distinct options." };
        emit({ type: "choices", options: clean, prompt: prompt ?? null });
        return { shown: true, options: clean };
      }),
    },

    {
      name: "capture_contact",
      node: "lead",
      label: "Capture contact",
      description:
        "Save who you are talking to, the moment they tell you. A 10-digit Indian mobile is " +
        "what makes the rest possible — a callback, a WhatsApp follow-up, and picking the " +
        "thread back up next time. Ask for it naturally once you have actually been useful, " +
        "never as the first thing you say, and never twice if they decline.",
      schema: z.object({
        name: z.string().optional().describe("What they said their name is"),
        phone: z.string().optional().describe("Indian mobile number, 10 digits"),
        email: z.string().optional(),
        company: z.string().optional().describe("What their business is"),
        intent: z.string().optional().describe("One line on what they actually want"),
      }),
      run: traced("lead", "Capture contact", async ({ name, phone, email, company, intent }) => {
        const p10 = phone ? normalizePhone(phone) : null;
        if (phone && !p10) {
          return { saved: false, error: "That does not look like a 10-digit Indian mobile number. Ask them to repeat it." };
        }
        if (name) identity.name = name;
        if (email) identity.email = email;
        if (p10) identity.phone10 = p10;
        emit({ type: "identity", name: identity.name, phone10: identity.phone10 });

        if (demo || !p10) {
          // Without a number there is no lead row to write — the name is still
          // worth keeping in the session so the agent can use it out loud.
          return { saved: false, held_in_session: true, name, phone10: p10, email, company, intent };
        }

        // A number we have seen before means a thread we can pick back up:
        // hand the agent the tail of it so it greets them as a return visit,
        // not a stranger. Checked before the upsert, which would create it.
        const existing = await conversationByPhone(p10).catch(() => null);
        const history = existing ? await recentMessages(p10, HISTORY_ON_CAPTURE).catch(() => []) : [];

        const lead = await upsertLead(p10, { name, status: "new", source: "web-voice" });
        identity.conversationId = await conversationId(p10, name ?? null);
        if (intent || company) {
          await touchConversation(p10, {
            text: [company && `Business: ${company}`, intent && `Wants: ${intent}`].filter(Boolean).join(" · "),
            direction: "in",
            contactName: name ?? null,
            openWindow: false,
            bumpUnread: false,
          }).catch(() => {});
        }
        return {
          saved: true,
          lead_id: lead?.id ?? null,
          phone10: p10,
          name: name ?? existing?.contact_name ?? null,
          email,
          company,
          intent,
          known_lead: !!existing,
          whatsapp_window_open: !!(existing?.window_open_until && new Date(existing.window_open_until) > new Date()),
          previous_messages: history.map((m) => ({
            from: m.direction === "in" ? "customer" : "us",
            via: m.type === "voice" ? "voice" : "whatsapp",
            text: m.body,
            at: m.created_at,
          })),
          hint: existing
            ? "You have spoken with this person before — acknowledge it and pick up where the thread left off."
            : undefined,
        };
      }),
    },

    {
      name: "request_callback",
      node: "callback",
      label: "Request a callback",
      description:
        "Have our outbound voice agent phone them right now, on the number you captured. " +
        "Offer this when they would rather talk than type, when they are on a phone and the " +
        "browser microphone is awkward, or when they explicitly ask to be called. Confirm " +
        "out loud that the phone is about to ring.",
      schema: z.object({
        reason: z.string().describe("Why they want the call, one short phrase"),
      }),
      run: traced("callback", "Request a callback", async ({ reason }) => {
        if (!identity.phone10)
          return { called: false, error: "No number captured yet. Use capture_contact first, then try again." };
        if (demo) return { called: false, simulated: true, phone10: identity.phone10, reason };
        const attemptId = await dialOut(identity.phone10, { name: identity.name, source: "web-voice" });
        emit({ type: "callback", phone10: identity.phone10 });
        return { called: true, attempt_id: attemptId, reason };
      }),
    },

    {
      name: "send_whatsapp_message",
      node: "whatsapp",
      label: "Send WhatsApp message",
      description:
        "Send them a WhatsApp message, in your words, on the number you captured. Use it when " +
        "they ask for something in writing, to send a summary of what you discussed, a price " +
        "from the playbook, or a link — or near the end of a good conversation so it continues " +
        "somewhere they will see it. Write it as a short WhatsApp message in their language. " +
        "Tell them it is on its way before you send it. Claim only what the tool result " +
        "confirms was actually sent.",
      schema: z.object({
        text: z
          .string()
          .max(700)
          .describe("The message, one to three short sentences, in the visitor's language"),
        reason: z.string().describe("Why, one short phrase"),
      }),
      run: traced("whatsapp", "Send WhatsApp message", async ({ text, reason }) => {
        if (!identity.phone10)
          return { sent: false, error: "No number captured yet. Use capture_contact first, then try again." };
        if (demo) return { sent: false, simulated: true, phone10: identity.phone10, text, reason };
        // Free text only inside WhatsApp's 24-hour window. Otherwise the text
        // rides inside the approved handoff template, which asks them to
        // reply — the reply is what opens the window for everything after.
        const r = await sendMessage(identity.phone10, text, { name: identity.name, source: "web-voice" });
        emit({ type: "whatsapp", phone10: identity.phone10, mode: r.mode, text: r.text });
        return {
          sent: true,
          message_id: r.messageId,
          mode: r.mode,
          delivered_as: r.text,
          note:
            r.mode === "template"
              ? "They have not messaged us on WhatsApp yet, so it went inside our approved template " +
                "and asks them to reply. Tell them to reply to it to continue there."
              : undefined,
          reason,
        };
      }),
    },

    {
      name: "escalate_to_human",
      node: "escalate",
      label: "Escalate to human",
      description:
        "Hand this to a person. Use it when they ask for a human, when it turns into a dispute, " +
        "a refund or a legal question, when the playbook cannot answer something they need " +
        "decided, or when the voice connection is failing them. If you already have their " +
        "number the thread is flagged for the team and the conversation continues on WhatsApp. " +
        "If you do not, a WhatsApp form opens in the panel asking for their name and number — " +
        "tell them to fill it in and that the team will message them there.",
      schema: z.object({
        reason: z.string().describe("Why this needs a person, one sentence"),
        summary: z
          .string()
          .optional()
          .describe("One sentence on what they want, for the human who picks it up"),
        urgency: z.enum(["normal", "high"]).optional(),
      }),
      run: traced("escalate", "Escalate to human", async ({ reason, summary, urgency }) => {
        outcome.escalated = true;
        outcome.handoffReason = reason;
        outcome.handoffSummary = summary ?? null;
        if (demo) return { escalated: false, simulated: true, reason, urgency: urgency ?? "normal" };

        if (!identity.phone10) {
          // Anonymous. The panel opens the WhatsApp form; the form's submit
          // creates the lead, flags the thread and sends the handoff template.
          emit({ type: "handoff", reason, summary: summary ?? null, name: identity.name });
          return {
            escalated: true,
            form_opened: true,
            reason,
            next:
              "A WhatsApp form is now on their screen. Tell them to enter their name and WhatsApp " +
              "number in it, and that the team will message them there. Do NOT call end_session — " +
              "stay on the line until they say they have filled it in or say goodbye.",
          };
        }

        await flagHandoff(identity.phone10, {
          reason,
          note: summary ?? null,
          runId: tracer.id,
          source: "web-voice",
          contactName: identity.name,
        });
        // Put something in their hand: the handoff message, with the reason in
        // it, so the thread exists on their phone before anyone picks it up.
        let sent = null;
        try {
          sent = await sendMessage(
            identity.phone10,
            summary
              ? `You asked to speak with someone about: ${summary}. A person from the team is picking this up.`
              : "You asked to speak with someone from the team, and a person is picking this up.",
            { name: identity.name, source: "web-voice" }
          );
          emit({ type: "whatsapp", phone10: identity.phone10, mode: sent.mode, text: sent.text });
        } catch (err) {
          console.error("escalate: whatsapp send failed", err.message);
        }
        emit({
          type: "handoff",
          reason,
          summary: summary ?? null,
          name: identity.name,
          phone10: identity.phone10,
          flagged: true,
        });
        return {
          escalated: true,
          thread_flagged: true,
          whatsapp_sent: !!sent,
          reason,
          urgency: urgency ?? "normal",
          next: sent
            ? "Tell them a message is on their WhatsApp and a person will continue there."
            : "Tell them the team has been notified and will reach them on WhatsApp.",
        };
      }),
    },

    {
      name: "end_session",
      node: "done",
      label: "End session",
      description:
        "Close the conversation after you have said goodbye. Use it when they say bye, when " +
        "they confirm there is nothing else, or after you have escalated and told them a " +
        "person will follow up. Say the goodbye first — this cuts the microphone.",
      schema: z.object({
        reason: z.string().describe("Why the session is ending, one short phrase"),
      }),
      run: traced("done", "End session", async ({ reason }) => {
        outcome.endSession = true;
        return { ending: true, reason };
      }),
    },
  ];
}
