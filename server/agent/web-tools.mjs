// Tools the website voice agent can call, on top of the shared ones.
//
// The shared set (search_playbook, update_lead, get_conversation_history,
// escalate_to_human) comes straight from tools.mjs, so a browser conversation
// hits the same playbook, writes the same lead row and lands on the same trace
// as WhatsApp and the phone line. What is added here is everything that only
// makes sense when the customer is looking at a web page:
//
//   navigate_site         drive the visitor's browser to the page being discussed
//   capture_contact       turn an anonymous visitor into a lead mid-sentence
//   request_callback      hand off to the outbound phone agent
//   send_whatsapp_followup  put the conversation somewhere they'll see it later
//   end_session           close the session politely
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
import { upsertLead, conversationId, insertMessage, touchConversation } from "../db.mjs";
import { phone10 as normalizePhone, sendTemplate } from "../wa.mjs";

/** Where the agent is allowed to send the browser. Anything else is refused. */
export const SITE_MAP = [
  { path: "/", label: "Home", about: "The agency overview and the ten heads." },
  { path: "/heads/agents", label: "Agentic AI & workflow automation", about: "Multi-step AI agents across your apps." },
  { path: "/heads/sdr", label: "Autonomous AI sales engine", about: "AI SDR on WhatsApp, email and LinkedIn." },
  { path: "/heads/voice", label: "Voice AI & call automation", about: "Voice agents for support and telesales." },
  { path: "/heads/geo", label: "GEO & programmatic SEO", about: "Being cited by ChatGPT, Perplexity and Gemini." },
  { path: "/heads/erp", label: "AI-driven ERP & supply chain", about: "OCR from invoices straight into the ledger." },
  { path: "/heads/ads", label: "Hyper-personalised ad campaigns", about: "Creative and targeting at ROAS." },
  { path: "/heads/bi", label: "Business intelligence", about: "Dashboards and decision support." },
  { path: "/heads/uiux", label: "UI/UX and product design", about: "Design work." },
  { path: "/heads/api", label: "API and integration work", about: "Connecting systems." },
  { path: "/heads/shield", label: "AI shield", about: "Brand safety and monitoring." },
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

        const lead = await upsertLead(p10, { name, status: "new" });
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
        return { saved: true, lead_id: lead?.id ?? null, phone10: p10, name, email, company, intent };
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
      name: "send_whatsapp_followup",
      node: "whatsapp",
      label: "Send WhatsApp follow-up",
      description:
        "Send them our approved WhatsApp intro so the conversation continues somewhere they " +
        "will actually see it later. Use it near the end of a good conversation, or when they " +
        "ask for something in writing. Tell them it is coming before you send it.",
      schema: z.object({
        reason: z.string().describe("Why, one short phrase"),
      }),
      run: traced("whatsapp", "Send WhatsApp follow-up", async ({ reason }) => {
        if (!identity.phone10)
          return { sent: false, error: "No number captured yet. Use capture_contact first, then try again." };
        if (demo) return { sent: false, simulated: true, phone10: identity.phone10, reason };
        const r = await sendTemplate(
          identity.phone10,
          process.env.WA_DEFAULT_TEMPLATE ?? "hi_intro",
          "en",
          [],
          "web-voice"
        );
        await insertMessage(identity.phone10, {
          direction: "out",
          type: "template",
          text: `[intro template sent from the website voice agent — ${reason}]`,
          source: "web-voice",
        }).catch(() => {});
        emit({ type: "whatsapp", phone10: identity.phone10 });
        return { sent: true, message_id: r.messageId, reason };
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
