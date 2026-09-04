# Agent stack

How Marketing Ravan orchestrates AI agents, and how clients watch them work.

Two goals drive every choice here: an orchestration layer we can trust in
production, and a website that *performs* the agents as a sales instrument.
The second one is why the trace tables exist — observability and the demo are
the same data.

---

## The layers

| Layer | Choice | Where | Cost |
|---|---|---|---|
| Agent loop | Two interchangeable engines | `server/agent/engines/` | model usage |
| Models | Google Gemini, per path | `server/agent/models.mjs` | see below |
| Tracing / observability | `agent_runs` + `agent_steps` in Postgres | `server/agent/trace.mjs` | $0 |
| Data | Supabase Postgres + pgvector | `server/db.mjs` | free tier |
| Retrieval | `policies.embedding` (gemini-embedding-001, 1024-dim) | `match_policies()` | usage |
| Playbook admin | `/admin` → Playbook tab | `server/public/admin.html` | $0 |
| Voice | Sarvam (Indian languages) | `server/index.mjs` | existing |
| WhatsApp | BSP panel (Meta proxy) | `server/wa.mjs` | existing |
| Live workflow UI | React Flow + Supabase Realtime | `site/src/pages/AgentWorkflows.jsx` | $0 |
| Site | Vite + React 19 + Tailwind 4 | `site/` | existing |

### Two engines, one contract

The agent loop is pluggable. `server/agent/engines/` holds two implementations
behind a single function:

```js
run({ tracer, specs, offer, userMessage, model })
  -> { reply, stopReason, refused }
```

| Engine | What it is | Why keep it |
|---|---|---|
| `mastra` | Mastra `Agent` over the Vercel AI SDK | **Production default.** Ergonomic, and the AI SDK layer means swapping model provider is one branch in `languageModel()`. |
| `langgraph` | Explicit `StateGraph` | Real graph semantics — nodes, conditional edges, a recursion limit. Where branching, retries and human-approval gates will go. Also the name enterprise buyers recognise. |

They share `prompt.mjs`, `tools.mjs` and `trace.mjs`, so a difference between
two runs is a difference between engines, not prompt drift. `agent_runs.engine`
records which one ran, and `/live` lets you pick.

**A third engine, `runner`, has been removed.** It was the Anthropic SDK's own
tool runner, and it spoke the Messages API directly — it could not reach any
other provider. It went when Anthropic did. Recover it from git history if
Claude ever comes back, and note that prompt caching and refusal fallbacks went
with it: both were Anthropic-only features.

**LangGraph does not use `createReactAgent`.** That prebuilt is deprecated in
`@langchain/langgraph` 1.x. The graph is built by hand, which is the point of
LangGraph anyway and makes the trace mirror the graph exactly.

### Models

`server/agent/models.mjs` is the registry: provider, price, and the capability
quirks that decide which request parameters an engine may send. Prices are USD
per million tokens, from Google's own pricing page, checked 2026-09-04.

| Model | Input | Output | Per turn* | At 200 demos/day |
|---|---|---|---|---|
| Gemini 3.8 Flash | $0.75 | $3.75 | ~$0.007 | ~$42/mo |
| Gemini 2.5 Flash | $0.30 | $2.50 | ~$0.003 | ~$18/mo |
| **Gemini 3.1 Flash-Lite** | **$0.25** | **$1.50** | **~$0.0016** | **~$9/mo** |
| Gemini 3.5 Flash-Lite | $0.30 | $2.50 | ~$0.003 | ~$18/mo |

\* one WhatsApp turn, ~6k input across three model calls, ~600 output.

⚠️ **Gemini 3.x Flash pricing is promotional and doubles on 2027-01-01**
($0.75/$3.75 → $1.50/$7.50). Revisit the production default before then.

**Per-path models.** `AGENT_MODEL` (real customers) defaults to
`gemini-3.8-flash` — Flash rather than Flash-Lite, because that path has to
judge escalation and mirror the customer's script. `AGENT_DEMO_MODEL` defaults
to `gemini-3.1-flash-lite`, the cheapest model that actually serves, because
the demo is the abuse-exposed path.

`gemini-2.5-flash-lite` ($0.10/$0.40) is deliberately **not** in the registry:
the docs list it as stable and `models.list` returns it, but `generateContent`
404s with "no longer available to new users". Verified 2026-09-04.

---

## How a run works

```
WhatsApp webhook  ──▶  ingest()  ──▶  runWhatsAppAgent()
                                          │
                            startRun() ───┴──▶ agent_runs (status: running)
                                          │
                            each node ────┴──▶ agent_steps (running → ok/error)
                                          │
                                          ▼
                                   Supabase Realtime
                                          │
                                          ▼
                              browser: React Flow lights up
```

Every step records latency, tokens and cost. A finished run carries its own
totals, so "what did this client's agent cost us last week" is a `sum()`, and
"show me exactly what it did" is a shareable link.

**Nodes are declared once**, in `server/agent/graph.mjs`, with layout
coordinates. The server writes `agent_steps.node` from that list; the site
fetches the same list from `GET /api/workflows` and renders it. There is no
second copy of the graph to drift.

---

## The demo (`/live`)

A visitor types a message; the real agent runs against it.

- Side effects are **simulated** (`demo: true`): no WhatsApp message is sent, no
  lead is written, no conversation row is created.
- The run is written with `demo = true`, which is the only thing the site's
  publishable key is allowed to read.
- `POST /api/agent/demo` returns the run id as soon as the row exists (202) and
  finishes the agent in the background — the browser subscribes and watches.
- `?run=<id>` replays any demo run. Shareable: hand a client the exact trace
  you are discussing on a call.
- Visitors pick the engine and the model. Running the same message through
  both engines and getting near-identical traces is the strongest version of
  the demo: it shows the orchestrator is an implementation detail and the
  agent logic is ours.

### Abuse surface — read this before going live

The demo spends real model tokens for anonymous visitors. Caps live in env:

```
AGENT_DEMO_PER_IP_PER_HOUR=5
AGENT_DEMO_PER_DAY=200
```

At the demo model's rates a turn costs ~$0.0016, so 200/day is ~$9/month. The
daily cap is the real ceiling — set it to a number you are happy to lose in a bad hour. The
per-IP limit is in-process, so it resets on deploy and does not survive
multiple instances. If the demo gets traffic, move both counters into Postgres
or put Cloudflare in front. `AGENT_DEMO_ENABLED=false` kills it instantly.

---

## Security posture

- `SUPABASE_SERVICE_ROLE_KEY` is server-only. `server/db.mjs` deliberately
  bypasses RLS and must never be imported by anything that ships to a browser.
- RLS: `agent_runs` / `agent_steps` expose `demo = true` rows to anon and
  authenticated. Everything else (`leads`, `conversations`, `messages`,
  `calls`, `offers`, `wa_events_raw`, `policies`) has RLS on with **no**
  policy — server-only by construction.
- `upsert_lead` and `touch_conversation` are `SECURITY DEFINER` (they need
  read-modify-write for `unread + 1`). EXECUTE is revoked from `PUBLIC`, `anon`
  and `authenticated` — Postgres grants EXECUTE to PUBLIC by default, so
  revoking from anon/authenticated alone is **not** enough.

Verified from the browser with the publishable key: private runs return 0 rows,
an unfiltered select returns only demo rows, and both RPCs return 42501.

Re-check after any schema change with the Supabase security advisor.

---

## Running it

```bash
npm start --prefix server     # API + agent on :8787
npm run dev --prefix site     # site on :5173, proxies /api → :8787
```

Playbook — the agent quotes only what is in here, so this is the first thing
to fill in for a new client:

```bash
node server/playbook.mjs seed     # starter rules (skips titles that exist)
node server/playbook.mjs embed    # embed anything missing a vector
node server/playbook.mjs list     # what is loaded, and what is embedded
node server/playbook.mjs search "kitna paisa lagega website ka"
```

Retrieval is cross-lingual: that Hinglish query returns the English
"Website pricing" rule at 0.73 similarity. Ask questions in the language your
customers actually use when checking coverage.

### Migrating an existing server off SQLite

The codebase moved from a local `better-sqlite3` file to Supabase. Deploying
the new code does **not** move the old data — it just stops reading it. A
server that has been running has real leads, calls and WhatsApp threads in
`server/data.sqlite`.

```bash
node server/migrate-sqlite.mjs                 # dry run, prints counts
node server/migrate-sqlite.mjs --apply         # write to Supabase
node server/migrate-sqlite.mjs --apply --with-raw   # include wa_events_raw
```

Reads through `node:sqlite` (built into Node 22), so nothing has to be
installed on the server just to migrate off it. Every write is an upsert on a
natural key — `phone10`, `attempt_id`, `wa_message_id` — so a partial run can
simply be repeated. Messages whose conversation row was pruned get a thread
rebuilt for them rather than being dropped.

Keep the `.sqlite` file as a cold backup until you have checked the row counts
in Supabase.

### Deploying

`deploy/deploy.sh` pulls main, builds the site, and restarts the service. Two
things it does *not* do:

- **Env lives at `/etc/marketingravan.env` on the VPS**, not `server/.env`.
  Every variable added locally has to be added there too or the service will
  exit on boot — `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
  `GOOGLE_GENERATIVE_AI_API_KEY`, `GOOGLE_API_KEY`, `AGENT_MODEL`,
  `AGENT_DEMO_MODEL`, `AGENT_ENGINE`.
- **It does not migrate data.** Run `migrate-sqlite.mjs` yourself.

Bench a model or engine before trusting it:

```bash
node server/compare.mjs                        # every runnable pair
node server/compare.mjs gemini-3.1-flash-lite  # one model
```

Required in `server/.env` (see the block at the bottom of that file):

| Var | Notes |
|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API |
| `GOOGLE_GENERATIVE_AI_API_KEY` + `GOOGLE_API_KEY` | aistudio.google.com/apikey. Both, because the AI SDK and LangChain read different names. Also powers playbook embeddings |
| `AGENT_MODEL` | production model, defaults to `gemini-3.8-flash` |
| `AGENT_DEMO_MODEL` | public demo model, defaults to `gemini-3.1-flash-lite` |
| `AGENT_ENGINE` | `mastra` (default) or `langgraph` |
| `VOYAGE_API_KEY` | optional — without it playbook search degrades to keyword matching |
| `AGENT_AUTOREPLY` | **`false`.** `true` lets the agent answer real customers unattended |
| `AGENT_DEMO_*` | public demo caps |

`AGENT_AUTOREPLY=false` is the important one. Turn it on only after watching
enough traces in `/admin` to trust the agent's judgement on refunds and
escalation.

---

## What is not built yet

Honest list, roughly in the order it will start to hurt:

0. **Script mirroring is inconsistent.** The same Hinglish question came back
   in Latin-script Hinglish on one run and Devanagari on another — same prompt,
   same model. Grounding, escalation and language *choice* are reliable; script
   *fidelity* is not. Worth an explicit script-detection step in the prompt if
   brand voice matters.

0b. **The playbook is placeholder commercials.** ₹45,000, ₹35,000, the refund
   policy — all invented by me as realistic-looking defaults. The agent quotes
   them verbatim. Replace every number via `/admin` → Playbook before this
   answers anyone paying.

1. **Durability.** An agent run that dies mid-flight leaves a row stuck in
   `running`. There is no queue and no retry. Supabase `pgmq` is already
   available in the project; Inngest is the hosted alternative.
2. **No admin auth beyond a shared password.** `/admin` is gated by
   `ADMIN_PASSWORD` in a Bearer header — fine for one operator, not for a team
   or a client portal. Supabase Auth is already in the project when that matters.

3. **Evals.** No regression suite. Before `AGENT_AUTOREPLY=true`, we want a set
   of real inbound messages with expected outcomes (escalate / qualify /
   answer), so a prompt change cannot silently make the agent worse.
4. **Client portal.** Auth exists in Supabase but no client-facing login. Each
   client should see their own runs — the RLS shape for that is a
   `client_id` on `agent_runs` plus a membership table.
5. **Streaming.** The demo shows steps, not tokens. The Vercel AI SDK route
   would stream the reply as it is written.
6. **Next.js migration.** Worth it for SEO and server components. Not urgent —
   and the honest sequencing is a portal on a subdomain first, marketing-site
   migration last.
