// Engine: LangGraph — an explicit state graph.
//
// Deliberately NOT `createReactAgent`: that prebuilt is deprecated in
// @langchain/langgraph 1.x (it moved to the `langchain` package), and building
// the graph by hand is the point of LangGraph anyway. Declaring the reason →
// tools → reason cycle as real nodes also means the trace mirrors the graph
// exactly, which is what the client-facing visualisation renders.

import { StateGraph, MessagesAnnotation, START, END } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { tool } from "@langchain/core/tools";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { systemString } from "../prompt.mjs";
import { requireModel } from "../models.mjs";

export const id = "langgraph";
export const label = "LangGraph state graph";
export const blurb =
  "Reason and tool execution as explicit graph nodes, with a conditional edge closing the loop.";

export const providers = ["google"];

/**
 * Build the chat model. LangChain has a class per provider, so adding one back
 * means another branch here — see requireModel() for the capability flags that
 * decide which parameters are safe to send.
 */
async function chatModel(model, info) {
  if (info.provider !== "google") {
    throw new Error(`Engine "langgraph" has no chat model for provider "${info.provider}".`);
  }
  const { ChatGoogleGenerativeAI } = await import("@langchain/google-genai");
  return new ChatGoogleGenerativeAI({ model, maxOutputTokens: 8192 });
}

/** Guard against a pathological tool loop burning the budget. */
const RECURSION_LIMIT = 12;

export async function run({ tracer, specs, offer, userMessage, model }) {
  const tools = specs.map((spec) =>
    tool(async (input) => JSON.stringify(await spec.run(input)), {
      name: spec.name,
      description: spec.description,
      schema: spec.schema,
    })
  );

  const llm = (await chatModel(model, requireModel(model))).bindTools(tools);

  // --- nodes -------------------------------------------------------------

  async function reason(state) {
    const step = await tracer.step("reason", { kind: "llm", label: "Model reasons" });
    try {
      const response = await llm.invoke(state.messages);
      await step.ok(
        {
          text: typeof response.content === "string" ? response.content : null,
          tool_calls: (response.tool_calls ?? []).map((c) => c.name),
        },
        response.usage_metadata
      );
      return { messages: [response] };
    } catch (err) {
      await step.fail(err);
      throw err;
    }
  }

  const toolNode = new ToolNode(tools);

  /** Loop back through the tools only while the model is still asking for them. */
  function shouldContinue(state) {
    const last = state.messages.at(-1);
    return last?.tool_calls?.length ? "tools" : END;
  }

  const graph = new StateGraph(MessagesAnnotation)
    .addNode("reason", reason)
    .addNode("tools", toolNode)
    .addEdge(START, "reason")
    .addConditionalEdges("reason", shouldContinue, ["tools", END])
    .addEdge("tools", "reason")
    .compile();

  // --- run ---------------------------------------------------------------

  const result = await graph.invoke(
    { messages: [new SystemMessage(systemString(offer)), new HumanMessage(userMessage)] },
    { recursionLimit: RECURSION_LIMIT }
  );

  const last = result.messages.at(-1);
  const reply =
    typeof last?.content === "string"
      ? last.content
      : (last?.content ?? [])
          .filter((b) => b.type === "text")
          .map((b) => b.text)
          .join("\n");

  return { reply: (reply ?? "").trim(), stopReason: "end_turn", refused: false };
}
