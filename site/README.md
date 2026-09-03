# Marketing Ravan — The Ten-Headed Growth Engine

Dark ember-themed marketing site. React 19 + Vite 7 + Tailwind CSS v4 +
Motion (Framer Motion) + GSAP ScrollTrigger + Lenis smooth scroll +
`<model-viewer>` for the 3D Ravan bust. Inspired by beew.studio's structure
(audited page by page); all content and assets are Marketing Ravan's own.

## Commands

```bash
npm install        # once
npm run dev        # dev server on http://localhost:5173
npm run build      # production build to dist/
npm run preview    # serve the production build locally
```

Deploy `dist/` to any static host (Vercel / Netlify / Cloudflare Pages).

## Page structure (top to bottom)

1. **Hero** — chute animation: golden Ravan heads (generated in the logo's
   style, `src/assets/head-badge.jpg`) ride a glowing arc with fire trails;
   each carries a `01 · AGENTS`-style function tag, hover pauses and shows
   the full capability + metric. Side cards: Dashanan OS + robot photo card.
2. **Image marquee** — scrolling product-mockup shots.
3. **Statement** — scrubbed word-by-word reveal (GSAP).
4. **The 10 Heads** — scroll-pinned stacked cards, near-viewport height, each
   with a giant watermark numeral and its own generated product visual
   (`src/assets/work-*.jpg`, one per head).
5. **Capability marquee** → **Deployments** (alternating concept-demo blocks
   with generated mockups) → **Process** → **Comparison table**.
6. **Dashanan band** — live interactive 3D robot (mindsphere-style): its head
   follows the visitor's cursor, with an idle sway when the cursor is quiet.
   Pipeline: nano banana rendered the head and headless body separately
   (styled from the Dashanan art) → Meshy converted each to textured 3D →
   `scripts/assemble-robot.py` (headless Blender) scales/mounts the head on
   the neck socket, pivots the Head node at the neck, decimates and exports
   the draco `public/models/ravan-bot.glb` (0.7 MB). The viewer is
   `src/components/RobotViewer.jsx` (three.js, lazy chunk); tracking ranges
   live in its `tick()`. Raw Meshy sources are kept in `../meshy-sources/`
   (not shipped). Re-run assembly after tweaking the knobs at the top of the
   script; it renders `scripts/robot-preview.png` for QA.
7. **Stats strip** — count-up metrics → **Why Us** bento with the rotating
   3D bust → **Testimonials** → **Pricing** (Monthly/Quarterly/Yearly toggle)
   → **Blog** → **FAQ** → **Contact** (3 option cards) → footer + giant wordmark.

## Where things live

- `src/data/heads.js` — the 10 capabilities; hero, cards and footer read from it.
- `src/components/Hero.jsx` — chute knobs: `SPEED`, `SPAWN`, `GHOSTS`.
- `src/index.css` — all theme tokens (colors, fonts) in the `@theme` block.
- `public/models/ravan-head-web.glb` — 0.6 MB draco bust (Meshy → Blender).
- `src/assets/*.jpg` — AI-generated (nano banana / Gemini) brand imagery:
  `robot-dashanan` (mascot), `work-*` (concept-demo mockups), `blog-*`
  (article art). Regenerate with `scripts/nanobanana.mjs`; use `--aspect 16:9`
  (16:10 is not supported).

## ⚠ Placeholder content — replace before launch

1. **Testimonials** — sample quotes, placeholder names.
2. **Pricing** — tier structure final; amounts ($1,900 / $4,500 / Custom) are samples.
3. **Contact email** `hello@marketingravan.com` and the WhatsApp link (`#` in
   `Contact.jsx`) — set real ones.
4. **Blog posts** — three draft cards; articles not written yet, links point to #contact.
5. **Social links** in the footer are `#`.
6. **Work section** items are labeled "CONCEPT DEMO" on purpose — swap in real
   case studies as they land.
