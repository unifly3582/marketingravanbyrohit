// Engine: Mastra.
//
// Mastra talks to models through the Vercel AI SDK, so Gemini arrives via
// @ai-sdk/google. No provider-specific reasoning config is passed: threading
// one through two abstraction layers is a good way to earn a 400.

import { Agent } from "@mastra/core/agent";
import { createTool } from "@mastra/core/tools";
import { systemString } from "../prompt.mjs";
import { requireModel } from "../models.mjs";

export const id = "mastra";
export const label = "Mastra agent";
export const blurb =
  "Mastra's Agent primitive over the Vercel AI SDK — swap the model provider in one line.";

export const providers = ["google"];

/**
 * Resolve the AI SDK language model. Mastra goes through the Vercel AI SDK, so
 * adding a provider back is installing its `@ai-sdk/*` package and adding a
 * branch here — the rest of the engine is unchanged.
 */
async function languageModel(model, info) {
  if (info.provider !== "google") {
    throw new Error(`Engine "mastra" has no provider package for "${info.provider}".`);
  }
  const { google } = await import("@ai-sdk/google");
  return google(model);
}

/** Ceiling on tool-call rounds, mirroring the other engines' loop guards. */
const MAX_STEPS = 8;

export async function run({ tracer, specs, offer, userMessage, model, channel = "whatsapp" }) {
  const tools = Object.fromEntries(
    specs.map((spec) => [
      spec.name,
      createTool({
        id: spec.name,
        description: spec.description,
        inputSchema: spec.schema,
        execute: async (input) => spec.run(input),
      }),
    ])
  );

  const agent = new Agent({
    id: "whatsapp-responder",
    name: "WhatsApp responder",
    instructions: systemString(offer, channel),
    model: await languageModel(model, requireModel(model)),
    tools,
  });

  // Mastra drives the loop internally, so steps are traced from its callback
  // rather than from a loop we own. One extra step is opened after the final
  // callback and skipped — same shape the runner engine produces.
  let step = await tracer.step("reason", { kind: "llm", label: "Model reasons" });

  const result = await agent.generate(userMessage, {
    maxSteps: MAX_STEPS,
    onStepFinish: async (s) => {
      const current = step;
      step = null;
      await current?.ok(
        {
          text: s?.text || null,
          tool_calls: (s?.toolCalls ?? []).map((c) => c.toolName ?? c.name).filter(Boolean),
        },
        s?.usage
      );
      step = await tracer.step("reason", { kind: "llm", label: "Model reasons" });
    },
  });

  if (step) await step.skip("no further turn");

  return {
    reply: (result?.text ?? "").trim(),
    stopReason: result?.finishReason ?? "end_turn",
    refused: result?.finishReason === "refusal",
  };
}
