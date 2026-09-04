// Workflow graph definitions.
//
// One source of truth: the server writes `agent_steps.node` values from here,
// and the site renders these same nodes/edges in React Flow. Served publicly
// over GET /api/workflows so the marketing site never has to duplicate them.

export const WORKFLOWS = {
  "whatsapp-responder": {
    id: "whatsapp-responder",
    title: "WhatsApp lead responder",
    blurb:
      "Every inbound WhatsApp message is read, checked against the client's playbook, " +
      "answered in the customer's own language, and either progressed or handed to a human.",
    // x/y are the canonical layout — the UI renders these directly rather than
    // running its own auto-layout, so the graph looks the same everywhere.
    nodes: [
      { id: "inbound", kind: "trigger", label: "Inbound message", hint: "WhatsApp webhook", x: 0, y: 200 },
      { id: "window", kind: "guard", label: "24h window check", hint: "Free-form vs. template", x: 230, y: 200 },
      { id: "context", kind: "tool", label: "Load thread history", hint: "Last 20 messages", x: 460, y: 200 },
      { id: "reason", kind: "llm", label: "Model reasons", hint: "LLM reasoning turn", x: 700, y: 200 },
      { id: "playbook", kind: "tool", label: "Search playbook", hint: "pgvector over policies", x: 960, y: 20 },
      { id: "lead", kind: "tool", label: "Update lead", hint: "Qualify + tag", x: 960, y: 140 },
      { id: "reply", kind: "tool", label: "Send reply", hint: "WhatsApp Business API", x: 960, y: 260 },
      { id: "escalate", kind: "tool", label: "Escalate to human", hint: "Flags the thread", x: 960, y: 380 },
      { id: "done", kind: "output", label: "Run complete", hint: "Traced + costed", x: 1220, y: 200 },
    ],
    edges: [
      ["inbound", "window"],
      ["window", "context"],
      ["context", "reason"],
      ["reason", "playbook"],
      ["reason", "lead"],
      ["reason", "reply"],
      ["reason", "escalate"],
      ["playbook", "reason"],
      ["lead", "reason"],
      ["reply", "done"],
      ["escalate", "done"],
    ],
  },

  "voice-responder": {
    id: "voice-responder",
    title: "Voice call responder",
    blurb:
      "Each caller utterance is transcribed, checked against the same client playbook the " +
      "WhatsApp agent uses, answered aloud in the caller's language, and either progressed or " +
      "handed to a human — sharing one lead record and one conversation thread with WhatsApp.",
    nodes: [
      { id: "inbound-audio", kind: "trigger", label: "Caller utterance", hint: "Sarvam STT transcript", x: 0, y: 200 },
      { id: "context", kind: "tool", label: "Load thread history", hint: "Last 20 messages, any channel", x: 260, y: 200 },
      { id: "reason", kind: "llm", label: "Model reasons", hint: "LLM reasoning turn", x: 500, y: 200 },
      { id: "playbook", kind: "tool", label: "Search playbook", hint: "pgvector over policies", x: 760, y: 20 },
      { id: "lead", kind: "tool", label: "Update lead", hint: "Qualify + tag", x: 760, y: 140 },
      { id: "speak", kind: "tool", label: "Speak reply", hint: "Sarvam TTS to the caller", x: 760, y: 260 },
      { id: "escalate", kind: "tool", label: "Escalate to human", hint: "Flags the thread", x: 760, y: 380 },
      { id: "done", kind: "output", label: "Turn complete", hint: "Traced + costed", x: 1020, y: 200 },
    ],
    edges: [
      ["inbound-audio", "context"],
      ["context", "reason"],
      ["reason", "playbook"],
      ["reason", "lead"],
      ["reason", "speak"],
      ["reason", "escalate"],
      ["playbook", "reason"],
      ["lead", "reason"],
      ["speak", "done"],
      ["escalate", "done"],
    ],
  },
};

export const workflow = (id) => WORKFLOWS[id] ?? null;
export const workflowList = () => Object.values(WORKFLOWS);

/** Node ids that exist in a graph — guards against typos in step() calls. */
export function assertNode(workflowId, nodeId) {
  const wf = WORKFLOWS[workflowId];
  if (wf && !wf.nodes.some((n) => n.id === nodeId)) {
    console.warn(`agent trace: unknown node "${nodeId}" for workflow "${workflowId}"`);
  }
}
