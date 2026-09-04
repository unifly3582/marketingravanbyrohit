# Ravan — the website voice agent

A visitor clicks the microphone button on marketingravan.com and talks to the
site. Ravan answers out loud in about a second, in English, Hindi or Hinglish,
answers only from the client playbook, **moves the page to whatever it is
describing**, and turns the conversation into a lead.

It is the product demo and the product at once. A prospect asking "can AI
really talk to my customers?" gets the answer by having the conversation.

Built 2026-09-05. Everything below is implemented and tested end to end unless
a line says otherwise.

---

## What it does

### 1. Greets, and says what it is

It opens in its own words — not a canned line — introducing itself as Marketing
Ravan's AI agent and asking what brought the visitor to the site. Because the
greeting is generated rather than scripted, it stays in whatever language the
visitor replies in.

### 2. Answers questions, grounded in the playbook

Every factual claim about pricing, deliverables, timelines, guarantees or terms
comes from `search_playbook` — pgvector search over the `policies` table, the
same one the WhatsApp and phone agents use. If the playbook doesn't cover it,
it says the team will confirm. It does not estimate, and it does not round a
number up because it sounds better.

Change what it can say by editing the playbook in `/admin`, not by editing code.

### 3. Drives the page while it talks

This is the part that sells. Ask "show me what you do for voice" and the browser
navigates to `/heads/voice` mid-sentence, with a visible chip in the panel
saying what it just did. It can reach any of 17 allowed routes; a path outside
that list is refused rather than followed, so it can never navigate a visitor
into a 404.

The allowed pages, and the one-line description the model sees for each, are in
`server/agent/web-tools.mjs` → `SITE_MAP`.

### 4. Qualifies the visitor

It asks what they sell, what they've tried, what's actually broken, and what
"working" would look like — conversationally, while being useful, not as a form.

### 5. Captures the lead

Once it has earned it, it asks for a name and mobile number and saves them with
`capture_contact`. That writes a real `leads` row and opens a conversation
thread shared with WhatsApp — so a visitor who talks to the website and later
messages on WhatsApp is one person in the system, not two.

It asks **once**. If they decline it drops the subject entirely and stays
helpful. That's a prompt rule, not a UI rule, and it's the first thing to check
if the agent ever starts nagging.

### 6. Closes it somewhere real

Three exits, all live:

| Tool | What happens |
|---|---|
| `request_callback` | Our outbound voice agent phones them, on the number just captured, within seconds |
| `send_whatsapp_followup` | Sends the approved WhatsApp intro template so the thread continues where they'll see it |
| `escalate_to_human` | Flags the conversation `needs_human` and tells them a person is coming |

### 7. Ends cleanly

On a goodbye it calls `end_session`, which releases the microphone, closes both
sockets, writes the transcript to the run, and turns the browser's recording
indicator off.

---

## What it deliberately does not do

- **No audio is stored.** Only the text transcript is kept, on the agent run.
  The panel says so to the visitor.
- **No camera, no screen share, no file access, no clipboard.** The microphone
  is the only permission requested. If asked, the agent says so plainly.
- **No reply tool.** It speaks natively; there is no text channel it could
  answer on twice.
- **No unattended promises.** It cannot claim something was sent or booked
  unless a tool result says it happened.
- **No anonymous data written.** A visitor who never gives a number leaves an
  agent run and a transcript and nothing else — no lead, no conversation row.

---

## Architecture

```
browser mic ──16 kHz µ-law───▶ our server ──▶ Gemini Live API
              (128 kbps up)         (expands to PCM16)
                                  │              (audio in/out, tools, VAD)
browser speaker ◀─24 kHz PCM16────┤
                                  ├──▶ playbook (pgvector over policies)
                                  ├──▶ leads / conversations / messages (Supabase)
                                  ├──▶ WhatsApp Business API
                                  └──▶ outbound voice agent (Vobiz)
```

**One model does everything.** Gemini's Live API hears, thinks, calls tools and
speaks inside a single WebSocket. No separate STT or TTS vendor.

### Why not the cascade the phone agent uses

Both paths were measured on this account on 2026-09-05 before choosing:

| | Gemini Live | Cascade (STT → agent → TTS) |
|---|---|---|
| Time to first audio | **988 ms**, including a full tool round trip | ~8–10 s |
| Speech-to-text | ~2 s (`gemini-3.1-flash-lite`) |
| Agent turn | 2–4 s (Mastra) |
| Text-to-speech | 4.2 s (`gemini-3.1-flash-tts-preview`, no streaming) |
| Barge-in | Built in | Would need our own VAD |

The TTS model has no streaming endpoint, so those 4.2 seconds are a floor, not
an average. Eight seconds of silence after every question is not a demo anyone
buys from. The phone pipeline keeps the cascade because Sarvam's Indic voices
are better on a 8 kHz phone line; the browser gets the Live API.

### Why the browser doesn't call Google directly

It could — ephemeral tokens exist. But the tools read the client's playbook,
write lead rows and send WhatsApp messages, all of which need the service-role
key. Relaying through our server costs a few milliseconds and buys the entire
tool surface, and the Google API key never reaches a browser.

### Where the agent frameworks fit

The repo has two working orchestrators (`mastra`, `langgraph`) behind one
interface. **Neither runs this agent** — for a realtime session the Live API
*is* the orchestrator, and putting a second loop inside it would only add the
latency we just spent effort removing.

What is shared is the layer that actually matters: `agent/tools.mjs` returns
engine-agnostic tool specs, and `voice/gemini-live.mjs` converts them into
Gemini function declarations. So the website agent, the WhatsApp agent and the
phone agent call **the same tool implementations**, against the same playbook,
writing the same trace. Swapping which loop drives them stays a one-line change.

### Latency, and how it was won back

The first version felt slow on the live site while every local number looked
fine. The cause was measurement: **typed turns skip end-of-speech detection**,
so text-mode timings are optimistic by about a second. `SPEAK=1` on the test
script speaks a real sentence instead, and that is the number that matters.

It was never the VPS. The box is in Mumbai, 85 ms from Google's endpoint, and
timings from the VPS and from a laptop were identical. Three things in our own
code were responsible:

| Cause | Cost | Fix |
|---|---|---|
| Microphone uplink larger than the connection | grows without bound | 8-bit µ-law, halving 256 kbps to 128 |
| Default end-of-speech detection, tuned for dictation | ~1130 ms every turn | `realtimeInputConfig` with high sensitivity and 300 ms silence → 736 ms |
| `search_playbook` on a 12-rule, 2.2 kB playbook | ~1300 ms per lookup | Inline the whole playbook in the prompt; drop the tool |
| Trace writes blocking each tool call | ~400 ms per tool | `defer: true` — same writes, off the critical path |

Measured end to end, from the visitor finishing their sentence to hearing the
first audio, including a tool call and a playbook-grounded answer:

```
before   ~3000 ms
after     658-1267 ms   (typically under a second)
```

A fourth cause lived in the browser, not the server. Raw 16 kHz PCM16 is
**32 kB/s of sustained upload**, and a typical Indian uplink measured here
carries 23 kB/s — the microphone stream physically could not keep up, so audio
arrived later than it was spoken and every reply inherited the backlog. The
worklet now compands to 8-bit G.711 µ-law before sending (128 kbps, 37.3 dB SNR
round trip, expanded back to PCM16 server-side), which is the same trade the
phone network has made for fifty years.

Where the time actually goes, same session measured from three places:

| Measured from | Wait after the visitor stops talking |
|---|---|
| VPS → localhost (no network) | ~600 ms |
| VPS → Cloudflare → VPS | ~780 ms |
| Laptop on a 23 kB/s uplink, PCM16 | ~2700 ms |
| Laptop on the same uplink, µ-law | ~1680 ms |

So what a visitor experiences depends heavily on their own connection, and
µ-law is worth about 40% of it. On a decent connection the agent answers in
well under a second.

The playbook is inlined only while it fits `INLINE_PLAYBOOK_CHAR_BUDGET`
(12 000 chars, ~40x the current playbook). Past that, `playbookFitsInline`
returns false, `search_playbook` comes back automatically, and retrieval
genuinely earns its round trip again. Nothing to remember, nothing to switch.

### Observability

Every session is one run in `agent_runs` (`workflow: "web-voice"`) with a step
per tool call in `agent_steps` — the same tables the `/live` React Flow page
already renders, so a web session animates through the graph exactly like a
WhatsApp run. The graph is defined in `server/agent/graph.mjs`.

A real session looks like this:

```
 1 session    trigger  ok    555ms   Session opened
 2 playbook   tool     ok   1431ms   Search playbook
 3 navigate   tool     ok    223ms   Navigate the site
 4 playbook   tool     ok   1319ms   Search playbook
 5 lead       tool     ok   1175ms   Capture contact
 6 done       tool     ok    522ms   End session
 7 done       output   ok    188ms   Session complete
```

---

## Browser permissions

**Microphone only**, requested with `getUserMedia` at the moment the visitor
clicks "Start talking" — never on page load. The panel explains what will be
asked before asking.

Echo cancellation, noise suppression and auto gain are all left to the browser;
without echo cancellation the agent hears its own voice through a laptop
speaker and interrupts itself.

Denial is handled explicitly: the visitor is told to allow it from the address
bar, and the typed-input path stays available so a refusal isn't a dead end.
Every session ends by calling `.stop()` on the media tracks, which is what
actually clears the browser's recording indicator.

A typed fallback runs the identical loop — for noisy rooms, open-plan offices,
and anyone who'd rather not talk out loud.

---

## Cost and limits

A ~45-second conversation costs about **$0.035**. Audio is billed at $3.00/M in
and $12.00/M out; the tracer records everything at the audio rate, which
slightly over-states spend on text tokens — the safe direction for a cost cap.

Five guards, all env-configurable:

| Guard | Default | Why |
|---|---|---|
| `WEB_VOICE_MAX_SESSION_MS` | 5 min | Hard ceiling on one conversation |
| `WEB_VOICE_IDLE_MS` | 45 s | Nobody has spoken — stop billing an empty room |
| `WEB_VOICE_MAX_CONCURRENT` | 4 | A crowd arriving at once |
| `WEB_VOICE_PER_IP_PER_HOUR` | 4 | One enthusiast reloading |
| `WEB_VOICE_PER_DAY` | 150 | Daily budget — about $5/day at the observed rate |

A refused session gets a spoken reason in the close frame, not a silent
failure. `WEB_VOICE_ENABLED=false` removes the microphone button from the site
entirely — the frontend checks `/api/voice/web/config` before rendering it.

---

## Where to change what it does

| To change… | Edit |
|---|---|
| **Its personality, rules and priorities** | `server/agent/prompt.mjs` → `WEB_BRAND` |
| What facts it can state | The playbook in `/admin` — no code change |
| Which pages it can open | `server/agent/web-tools.mjs` → `SITE_MAP` |
| What tools it has | `server/agent/web-tools.mjs` (web-only) and `server/agent/tools.mjs` (shared with WhatsApp + phone) |
| Its voice | `WEB_VOICE_VOICE` — `Kore`, `Puck`, `Charon`, `Fenrir`, `Aoede` |
| The model | `AGENT_LIVE_MODEL` (must support `bidiGenerateContent`) |
| The panel, captions, launcher | `site/src/components/VoiceAgent.jsx` |
| Mic capture, playback, socket | `site/src/lib/voiceAgent.js`, `site/public/voice-worklet.js` |
| The `/live` graph it renders as | `server/agent/graph.mjs` → `web-voice` |

`WEB_BRAND` is the file to open first. Nearly everything about *what the agent
does* is a paragraph in there, not a code path.

---

## Files

**Server**
- `server/voice/gemini-live.mjs` — Live API wire protocol; zod → Gemini function declarations
- `server/voice/web-session.mjs` — one session: browser ↔ Gemini, tools, transcript, tracing, teardown
- `server/agent/web-tools.mjs` — `navigate_site`, `capture_contact`, `request_callback`, `send_whatsapp_followup`, `end_session`
- `server/agent/prompt.mjs` — `WEB_BRAND`
- `server/agent/tools.mjs` — shared tools, now resolving the customer at call time
- `server/agent/graph.mjs`, `server/agent/models.mjs` — graph + model registry
- `server/voice/index.mjs` — WS routing, rate limits, `GET /api/voice/web/config`

**Site**
- `site/src/components/VoiceAgent.jsx` — floating launcher + panel
- `site/src/lib/voiceAgent.js` — mic, socket, scheduled playback, barge-in
- `site/public/voice-worklet.js` — capture on the audio thread, resample to 16 kHz

**Ops**
- `deploy/nginx-marketingravan.conf` — WebSocket upgrade blocks
- `server/test-web-voice.mjs` — headless smoke test

---

## Testing

Talk to it without a browser — same socket, same loop, typed instead of spoken:

```bash
node server/test-web-voice.mjs
```

It runs a scripted conversation and prints transcripts, tool calls, navigation
and per-turn latency. Pass your own lines as arguments to try something
specific.

**Use `SPEAK=1` when you care about speed.** It synthesises each line, streams
it at real-time pace and holds the mic open on silence afterwards, so
end-of-speech detection actually runs. Typed turns skip it and flatter the
numbers by about a second:

```bash
SPEAK=1 node server/test-web-voice.mjs "what does a WhatsApp agent cost?"
```

Against production:

```bash
TEST_WS_BASE=wss://marketingravan.com SPEAK=1 node server/test-web-voice.mjs
```

**Note:** it captures a real lead (`9876543210`) unless you change the script.
Delete the row afterwards, or the dashboard fills with test prospects.

---

## Deployment

Two things beyond a normal deploy:

1. **nginx must upgrade the WebSocket.** `deploy/nginx-marketingravan.conf` now
   has dedicated blocks for `/api/voice/web` and `/api/voice/stream/` with
   `proxy_http_version 1.1`, the Upgrade/Connection headers, and long read
   timeouts. Without them the socket silently never opens and the panel sits on
   "Connecting" forever — no error in any log. *(The telephony stream had the
   same gap; both are fixed.)*

2. **Copy the `WEB_VOICE_*` and `AGENT_LIVE_MODEL` keys** from `server/.env`
   into `/etc/marketingravan.env`. They all have working defaults, so a missed
   key degrades to the default rather than crashing — but the cost caps are
   among them.

`vite.config.js` also needed `ws: true` on the dev proxy for the same reason.

**TLS is terminated by Cloudflare**, not nginx — the origin only ever speaks
plain HTTP. Cloudflare proxies WebSockets on all plans, and
`wss://marketingravan.com/api/voice/web` was verified working through it on
2026-09-05. If the agent ever stops connecting in production while working
locally, check Cloudflare's WebSocket setting before touching nginx.

`deploy/nginx-marketingravan.conf` mirrors the installed file but is **not**
copied by `deploy.sh` — diff and patch by hand. It had drifted badly (it said
`listen 80 default_server; server_name _;`), so copying it wholesale would have
hijacked the default vhost for every other site on the box.

---

## Known gaps

- **Not tried on a real phone browser yet.** iOS Safari is the risk: it is the
  strictest about `AudioContext` creation outside a user gesture, and about two
  contexts at once. Both are created inside the click handler, which should be
  correct, but it needs a real device.
- **No language pin.** The agent opens in English and follows the visitor from
  their first reply. There is no way yet to force Hindi-only for a campaign.
  (It used to sometimes open in Hindi and then stay there even when answered in
  English — fixed in the prompt, worth re-checking if the prompt is edited.)
- **`update_lead` and `capture_contact` overlap.** One sets the qualification
  stage, the other identity. Distinct in their descriptions; worth watching
  whether the model ever reaches for the wrong one.
- **Cost is recorded at the audio rate for all tokens.** Deliberate
  over-estimate — see above — but it means the dashboard's daily spend is a
  ceiling, not an exact figure.
