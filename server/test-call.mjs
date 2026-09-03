// One-off test: trigger an instant outbound call via Sarvam's API.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dir = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(join(dir, ".env"), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);

const to = process.argv[2];
if (!to) {
  console.error("Usage: node test-call.mjs +91XXXXXXXXXX");
  process.exit(1);
}

const url = `https://apps.sarvam.ai/api/outbounds/v1/orgs/${env.SARVAM_ORG_ID}/workspaces/${env.SARVAM_WORKSPACE_ID}/outbounds`;

const body = {
  app_config: {
    app_id: "Conversatio-1b327c92-3694",
    app_version: 2,
    connection_config: {
      connection_id: "8efca9cf-94-b9219a1c-5823",
      agent_phone_number: env.AGENT_PHONE_NUMBER,
    },
  },
  user_config: { user_phone_number: to },
};

const res = await fetch(url, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-API-Key": env.SARVAM_SAMVAAD_API_KEY,
    Authorization: `Bearer ${env.SARVAM_SAMVAAD_API_KEY}`,
  },
  body: JSON.stringify(body),
});

console.log("Status:", res.status);
console.log(await res.text());
