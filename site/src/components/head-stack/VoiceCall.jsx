import { useEffect, useRef, useState } from "react";
import ravan from "../../assets/agents/voice-1.webp";
import "./voice-call.css";

/*
 * The AI Calling card's visual: one customer call, told as a story, on a
 * 23-second loop that restarts every time the card comes to the front.
 *
 *   0-2.6s   the phone rings; Ravan picks up (a chip says how fast)
 *   2.6-7s   the customer asks about her order, Ravan answers in Hindi-English
 *   7-10.4s  he thinks: matches the caller, reads the orders database
 *   10.4-15s he answers with the delivery slot; she asks to move it; done
 *   15-18.8s the database row changes in front of the visitor, then the
 *            side effects tick off: WhatsApp, delivery partner, CRM
 *   18.8-23s call ended, resolved, no human. Meanwhile the same agent is on
 *            38 other calls in five languages.
 *
 * Plain DOM, no canvas: the point is the text, and it has to be crisp at
 * card size. One rAF loop quantised to 100 ms drives a `t` state; every
 * element decides from `t` whether it exists, and CSS keyframes do the
 * entrances. Runs only while the card is in the middle of the pile.
 */
const LOOP = 23;
const reduced =
  typeof matchMedia === "function" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;

const PICKUP = 2.4;
const SPEAK = 2.4; // how long a Ravan line counts as him speaking
const LINES = [
  {
    at: 2.9,
    who: "cust",
    text: "Hi, I ordered a sofa last week. When is it coming?",
  },
  {
    at: 5.0,
    who: "ravan",
    text: "Namaste Priya ji! One second, let me check that for you.",
  },
  {
    at: 10.6,
    who: "ravan",
    text: "It’s out for delivery: Thursday, 2 to 5 PM.",
  },
  { at: 12.6, who: "cust", text: "Can you make it Saturday morning instead?" },
  {
    at: 14.3,
    who: "ravan",
    text: "Done. Saturday, 9 to 12. Confirmation is on your WhatsApp.",
  },
];
const THINK = [
  { at: 7.0, label: "Caller matched", val: "Priya Sharma · Pune" },
  { at: 7.9, label: "Reading orders", val: "#4821 · 3-seater sofa" },
  { at: 8.8, label: "Delivery status", val: "Out for delivery · Thu 2–5 PM" },
  { at: 9.6, label: "Answer ready", val: "in 1.2s" },
];
const CHANGE_AT = 15.0;
const ACTIONS = [
  { at: 15.5, text: "Delivery slot moved to Sat 9–12" },
  { at: 16.3, text: "WhatsApp confirmation sent" },
  { at: 17.1, text: "Delivery partner notified" },
  { at: 17.9, text: "CRM note added: happy customer" },
];
const WRAP_AT = 18.8;
const MEANWHILE_AT = 19.8;
const CALLS = 38;
const LANGS = ["हिंदी", "मराठी", "தமிழ்", "ગુજરાતી", "English"];
const TOOLS = ["ORDERS DB", "CRM", "CALENDAR", "WHATSAPP"];

const phaseOf = (t) => {
  if (t < 2.6) return "ring";
  if (t < 6.9) return "talk";
  if (t < 10.4) return "think";
  if (t < CHANGE_AT) return "talk";
  if (t < WRAP_AT) return "update";
  return "wrap";
};
const mmss = (s) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

const Check = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <path
      d="M3 8.5l3 3 7-7"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
const Phone = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <path
      d="M3.5 1.5h2.2l1.1 3-1.5 1.1a8 8 0 0 0 4.1 4.1l1.1-1.5 3 1.1v2.2a1.5 1.5 0 0 1-1.6 1.5A11.5 11.5 0 0 1 2 3.1 1.5 1.5 0 0 1 3.5 1.5z"
      fill="currentColor"
    />
  </svg>
);
const Db = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <ellipse
      cx="8"
      cy="3.5"
      rx="5.5"
      ry="2"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
    />
    <path
      d="M2.5 3.5v9c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2v-9M2.5 8c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
    />
  </svg>
);

const STAGE_W = 408; // the layout is drawn at the desktop card size (408x309) and scaled to fit

export default function VoiceCall({ active }) {
  const hostRef = useRef(null);
  // frozen mid-story for reduced motion and for cards behind the front one
  const [t, setT] = useState(reduced ? 9.9 : 0);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const fit = () =>
      host.style.setProperty("--s", (host.clientWidth / STAGE_W).toFixed(4));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(host);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!active || reduced) return;
    let raf = 0;
    let t0 = performance.now();
    const tick = (now) => {
      let tt = ((now - t0) / 1000) % LOOP;
      if (import.meta.env.DEV && window.__vcHold != null) tt = window.__vcHold;
      setT(Math.floor(tt * 10) / 10);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick); // first frame lands at t≈0: the story restarts
    // dev: jump the story to a second (__vcSeek) or freeze it there (__vcHold), to look at one beat
    if (import.meta.env.DEV)
      window.__vcSeek = (s) => {
        t0 = performance.now() - s * 1000;
      };
    return () => cancelAnimationFrame(raf);
  }, [active]);

  const phase = phaseOf(t);
  const picked = t >= PICKUP;
  const speaking = LINES.some(
    (l) => l.who === "ravan" && t >= l.at && t < l.at + SPEAK,
  );
  const listening = LINES.some(
    (l) => l.who === "cust" && t >= l.at && t < l.at + 1.8,
  );
  // each talk segment shows only its own lines: the second one starts after the thinking
  const talkLines =
    phase === "talk"
      ? LINES.filter(
          (l) => l.at <= t && (t < 10.4 ? l.at < 10.4 : l.at >= 10.4),
        ).slice(-2)
      : [];
  const showDb =
    (phase === "think" && t >= 8.8) ||
    (phase === "talk" && t >= 10.4) ||
    phase === "update";
  const changed = t >= CHANGE_AT;
  const calls = Math.min(
    CALLS,
    Math.max(0, Math.floor((t - MEANWHILE_AT) * 16)),
  );

  return (
    <div
      ref={hostRef}
      className={`vc vc-${phase}${speaking ? " is-speaking" : ""}`}
      aria-hidden="true"
    >
      <div className="vc-stage">
        <div className="vc-glow" />

        {/* Ravan, headset on, at the right; the glow behind him swells when he talks */}
        <img className="vc-ravan" src={ravan} alt="" decoding="async" />
        {/* tool chips drift up beside him while he works, like the Meta tags */}
        {(phase === "think" || phase === "update") &&
          TOOLS.map((name, i) => (
            <span key={name} className="vc-tool" style={{ "--i": i }}>
              {name}
            </span>
          ))}

        {/* the call itself, in the left column */}
        <div className="vc-col">
          {phase === "ring" && (
            <div className={`vc-ring${t >= 2.1 ? " is-accepting" : ""}`}>
              <span className="vc-avatar">
                PS
                <i />
                <i />
              </span>
              <div className="vc-who">
                <b>Priya Sharma</b>
                <span>+91 98••• ••210 · Incoming</span>
              </div>
              <span className="vc-accept">
                <Phone />
              </span>
            </div>
          )}

          {picked && phase !== "wrap" && (
            <div className="vc-status">
              <i className="vc-dot" />
              <b>Priya Sharma</b>
              <span className="vc-timer">{mmss(t - PICKUP)}</span>
              {t < 6.0 ? (
                <span className="vc-fast">Picked up in 0.8s</span>
              ) : (
                <span className={`vc-voice${speaking ? " on" : ""}`}>
                  <span className="vc-bars">
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                  </span>
                  {speaking
                    ? "Ravan speaking"
                    : listening
                      ? "Listening"
                      : phase === "update"
                        ? "Updating"
                        : "Thinking"}
                </span>
              )}
            </div>
          )}

          {talkLines.map((l) => (
            <div key={l.at} className={`vc-line is-${l.who}`}>
              <b>{l.who === "ravan" ? "Ravan" : "Priya"}</b>
              <span>{l.text}</span>
            </div>
          ))}

          {phase === "think" && (
            <div className="vc-think">
              <div className="vc-think-head">Ravan is thinking</div>
              {THINK.filter((s) => s.at <= t).map((s) => (
                <div
                  key={s.at}
                  className={`vc-step${t >= s.at + 0.6 ? " done" : ""}`}
                >
                  <i>{t >= s.at + 0.6 ? <Check /> : null}</i>
                  <span>{s.label}</span>
                  <em>{s.val}</em>
                </div>
              ))}
            </div>
          )}

          {showDb && (
            <div className={`vc-db${changed ? " is-changed" : ""}`}>
              <div className="vc-db-head">
                <Db />
                orders
                {changed && <b>UPDATED</b>}
              </div>
              <div className="vc-row">
                <span>#4821</span>
                <span>Priya S.</span>
                <span className="vc-slot">
                  {changed ? (
                    <>
                      <s>Thu 2–5</s>
                      <b>Sat 9–12</b>
                    </>
                  ) : (
                    <b>Thu 2–5 PM</b>
                  )}
                </span>
              </div>
            </div>
          )}

          {phase === "update" && (
            <div className="vc-actions">
              {ACTIONS.filter((a) => a.at <= t).map((a) => (
                <div key={a.at} className="vc-action">
                  <i>
                    <Check />
                  </i>
                  <span>{a.text}</span>
                </div>
              ))}
            </div>
          )}

          {phase === "wrap" && (
            <>
              <div className="vc-ended">
                <i>
                  <Phone />
                </i>
                <div>
                  <b>Call ended · {mmss(WRAP_AT - PICKUP)}</b>
                  <span>Resolved. No human needed.</span>
                </div>
              </div>
              {t >= MEANWHILE_AT && (
                <div className="vc-meanwhile">
                  <div className="vc-count">
                    <b>{calls}</b> other calls, right now
                  </div>
                  <div className="vc-grid">
                    {Array.from({ length: 24 }, (_, i) => (
                      <i
                        key={i}
                        className={
                          i < Math.round((calls / CALLS) * 24) ? "on" : ""
                        }
                      />
                    ))}
                  </div>
                  <div className="vc-langs">
                    {LANGS.map((l, i) => (
                      <span
                        key={l}
                        className={calls >= (i + 1) * 6 ? "on" : ""}
                      >
                        {l}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
