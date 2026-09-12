// Create or inspect the WhatsApp templates the agents depend on.
//
//   node wa-templates.mjs                  list every template on the WABA, any status
//   node wa-templates.mjs create           submit the handoff template (idempotent: skips if it exists)
//   node wa-templates.mjs create web_demo  submit the live-demo template
//
// Both are submitted as UTILITY, not MARKETING, on purpose: utility templates
// are reviewed faster and cost less, and these are genuinely transactional —
// the customer asked, on the website, for exactly this message. (Meta filed
// web_handoff as MARKETING anyway; if web_demo comes back the same way, the
// code still works, it just costs more per send.) Parameters are filled at
// send time — see HANDOFF_TEMPLATE and DEMO_TEMPLATE in wa.mjs.
import "./env.mjs";
import { LOCAL_TEMPLATES } from "./wa.mjs";

const env = (k) => process.env[k];
const base = `${env("WA_API_URL")}/${env("WA_API_VERSION")}`;
const headers = { Authorization: `Bearer ${env("WA_ACCESS_TOKEN")}`, "Content-Type": "application/json" };

async function call(path, init = {}) {
  const res = await fetch(`${base}${path}`, { headers, ...init });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(data).slice(0, 400)}`);
  return data;
}

async function list() {
  const data = await call(`/${env("WA_WABA_ID")}/message_templates?limit=100`);
  for (const t of data.data ?? []) {
    const body = (t.components ?? []).find((c) => c.type === "BODY")?.text ?? "";
    console.log(`${t.status.padEnd(9)} ${t.category.padEnd(10)} ${t.language.padEnd(6)} ${t.name}\n    ${body.replace(/\n/g, "\n    ")}`);
  }
  return data.data ?? [];
}

async function create(name) {
  const tpl = LOCAL_TEMPLATES.find((t) => t.name === name) ?? LOCAL_TEMPLATES[0];
  const existing = (await list()).find((t) => t.name === tpl.name);
  if (existing) {
    console.log(`\n${tpl.name} already exists (${existing.status}); nothing to do.`);
    return;
  }
  const payload = {
    name: tpl.name,
    language: tpl.language,
    category: tpl.category ?? "UTILITY",
    components: [
      {
        type: "BODY",
        text: tpl.body,
        example: { body_text: [tpl.example] },
      },
      { type: "FOOTER", text: "Reply STOP to opt out." },
    ],
  };
  const out = await call(`/${env("WA_WABA_ID")}/message_templates`, { method: "POST", body: JSON.stringify(payload) });
  console.log("\nsubmitted:", JSON.stringify(out));
}

const cmd = process.argv[2] ?? "list";
(cmd === "create" ? create(process.argv[3]) : list()).catch((e) => {
  console.error(e.message);
  process.exit(1);
});
