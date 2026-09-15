// Benchmark the phone agent's brain: how long until speak_reply is called?
//
// Runs the real voice system prompt and the real tool surface (with the
// side-effecting tools stubbed) through Mastra + Gemini, for several
// model / thinking configurations, and prints time-to-first-speech.
//
//   node bench-voice-brain.mjs                # all configs, two turns each
//   node bench-voice-brain.mjs gemini-3.8-flash low
//
// Nothing here writes to Supabase or dials anything.

import "./env.mjs";
import { Agent } from "@mastra/core/agent";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { systemString, currentOffer, voiceUserTurn } from "./agent/prompt.mjs";

const TURNS = ["Hello.", "What can you do for me?", "I have a pet food store."];

const CONFIGS = [
  { model: "gemini-3.8-flash", thinkingLevel: null },
  { model: "gemini-3.8-flash", thinkingLevel: "minimal" },
  { model: "gemini-3.8-flash", thinkingLevel: "low" },
  { model: "gemini-3.1-flash-lite", thinkingLevel: null },
  { model: "gemini-3.1-flash-lite", thinkingLevel: "minimal" },
];

const PLAYBOOK_STUB = {
  mode: "stub",
  results: [
    { rule: "We build AI agents and marketing systems for Indian businesses: WhatsApp sales agents, voice agents, websites, Meta ads. Retainers start at twenty-five thousand rupees a month." },
  ],
};

function tools(onSpeak) {
  return {
    search_playbook: createTool({
      id: "search_playbook",
      description: "Search the client's approved playbook — pricing, offers, delivery terms, refund rules, escalation triggers. Call this before making any factual claim about the business.",
      inputSchema: z.object({ query: z.string() }),
      execute: async () => PLAYBOOK_STUB,
    }),
    update_lead: createTool({
      id: "update_lead",
      description: "Record what you learned about this lead: their name, and their stage — 'new', 'qualified', 'nurture', or 'lost'.",
      inputSchema: z.object({ name: z.string().optional(), status: z.enum(["new", "qualified", "nurture", "lost"]).optional(), note: z.string().optional() }),
      execute: async (i) => ({ updated: true, ...i }),
    }),
    speak_reply: createTool({
      id: "speak_reply",
      description: "Say something to the caller — spoken aloud by text-to-speech. Short plain spoken sentences. Call this exactly once per turn, as your final action.",
      inputSchema: z.object({ text: z.string().max(600) }),
      execute: async ({ text }) => { onSpeak(text); return { spoken: true, text }; },
    }),
    end_call: createTool({
      id: "end_call",
      description: "Close out the call after you've said goodbye with speak_reply.",
      inputSchema: z.object({ reason: z.string() }),
      execute: async () => ({ ending: true }),
    }),
  };
}

async function bench({ model, thinkingLevel }, instructions) {
  const { google } = await import("@ai-sdk/google");
  const providerOptions = thinkingLevel ? { google: { thinkingConfig: { thinkingLevel } } } : undefined;
  const rows = [];
  for (const said of TURNS) {
    let spokeAt = null;
    let spoken = "";
    const agent = new Agent({
      id: "bench",
      name: "bench",
      instructions,
      model: google(model),
      tools: tools((text) => { spokeAt ??= Date.now(); spoken = text; }),
    });
    const t0 = Date.now();
    let usage = {};
    try {
      const r = await agent.generate(voiceUserTurn("Rohit", "9999999999", said), { maxSteps: 8, providerOptions });
      usage = r?.totalUsage ?? r?.usage ?? {};
    } catch (err) {
      rows.push({ said, error: err.message.slice(0, 120) });
      continue;
    }
    rows.push({
      said,
      toSpeakMs: spokeAt ? spokeAt - t0 : null,
      totalMs: Date.now() - t0,
      outTokens: usage.outputTokens ?? usage.completionTokens ?? null,
      reasoningTokens: usage.reasoningTokens ?? usage.outputTokenDetails?.reasoningTokens ?? null,
      reply: spoken.slice(0, 70),
    });
  }
  return rows;
}

const offer = await currentOffer();
const instructions = systemString(offer, "voice");
console.log(`system prompt ≈ ${Math.round(instructions.length / 4)} tokens\n`);

const only = process.argv[2];
const level = process.argv[3];
const configs = only ? [{ model: only, thinkingLevel: level && level !== "none" ? level : null }] : CONFIGS;

for (const cfg of configs) {
  console.log(`=== ${cfg.model}  thinkingLevel=${cfg.thinkingLevel ?? "(default)"} ===`);
  const rows = await bench(cfg, instructions);
  for (const r of rows) console.log("  ", JSON.stringify(r));
  console.log();
}
