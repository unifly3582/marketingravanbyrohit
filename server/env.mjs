// Loads server/.env into process.env as an import side effect.
//
// This exists as its own module because of ESM evaluation order: imports are
// hoisted and their modules run before any top-level code in the importer. So
// an inline .env loader in index.mjs runs too late — db.mjs has already been
// evaluated and exited over a missing SUPABASE_URL.
//
// Import this FIRST, before anything that reads env at module scope:
//
//   import "./env.mjs";
//   import { sb } from "./db.mjs";
//
// Real environment variables always win, so container/systemd config overrides
// the file rather than the other way round.

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const envFile = join(dirname(fileURLToPath(import.meta.url)), ".env");

if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const i = line.indexOf("=");
    const key = line.slice(0, i).trim();
    const value = line.slice(i + 1).trim();
    // Skip blanks so an empty placeholder does not mask a real exported value.
    if (value && !(key in process.env)) process.env[key] = value;
  }
}
