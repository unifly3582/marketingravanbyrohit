# Marketing Ravan — Site Plan (v2, multi-page)

Based on a page-by-page study of beew.studio (browsed desktop + mobile, plus
three research agents over every page). This file is the source of truth for
structure; check items off as they ship.

## What the study found on beew.studio

| Page | Sections (in order) | Notes we borrow |
|---|---|---|
| Home | White hero card + right rail (club card, team/$3.2M photo card) → work-image marquee → word-reveal statement → 6 stacked service cards → highlighted case blocks → process (subscribe/queue/review with a white kanban card) → comparison table → bento (stats/counters) → testimonial carousel → pricing (3 tiers, M/Q/Y toggle) → FAQ → blog cards → giant CTA → mega footer + giant wordmark | **Light-in-dark rhythm**: the shell is dark but the hero card, kanban card, pricing cards and testimonial cards are LIGHT. Our v1 was 100% dark — v2 alternates. |
| /works | "Design that moves products forward." + 17 project rows (category eyebrow + name + service line) + CTA | Our /works lists the Aurora case + concept demos |
| Case studies (mindsphere, 5u) | Dark cinematic hero (mindsphere: 3D robot on glowing stage) → metadata grid (SERVICES / CATEGORY / TECH STACK / DURATION) → challenges → objectives → process & solutions → gallery of browser-framed + phone-framed shots with eyebrow labels ("HOME PAGE 2025") → results → prev/next case nav | This is the model for **/case/aurora-robotics** — our robot belongs HERE, presented as work for a (fictional, clearly-labeled concept) robotics client, not as our mascot |
| /design-subscription | 17 sections: hero + badges, 4 icon cards, selected works, how-it-works, comparison, why-us, best-fit cards, what-you-can-request, 5-step flow, what's included, pricing, testimonials, FAQ, contact, CTA | Feeds /pricing + /about content patterns |
| /pricing | Pricing (toggle) → why-us → categories → testimonials → FAQ → CTA | Our /pricing mirrors this |
| /about | "A small studio built for ambitious ideas." → JS counters → approach → strategy statement → remote-by-default grid → CTA | Our /about mirrors this |
| /contact | "Tell us what you're building." + 3 option cards (project / subscription / call) + testimonials + CTA | Our /contact mirrors this |
| /blog | Listing: type label + date + read time + title + tags + READ | Our /blog (3 draft posts) |

## Our page map (react-router)

- [x] `/` Home — full-width chute hero (heads slowed) → side-cards row →
      image marquee → statement (word reveal) → 10 stacked head cards →
      capability marquee → **Aurora case teaser** (replaces "Dashanan unit" band)
      → process (LIGHT section) → stats strip → why-us bento (3D bust) →
      testimonials → blog preview → contact CTA → footer
- [x] `/works` — hero + project rows (Aurora Robotics case + 5 concept demos
      with images) + CTA
- [x] `/case/aurora-robotics` — mindsphere-style concept case:
      dark hero with the **interactive cursor-tracking robot**, "CONCEPT
      CASE" label, metadata grid, challenges/objectives (LIGHT), gallery of
      generated Aurora mockups (hero / features / mobile — cool cyan client
      palette), design-outcome results, back-to-works nav
- [x] `/about` — statement hero, approach trio (LIGHT), stats, async grid, CTA
- [x] `/pricing` — pricing (toggle, LIGHT cards) + comparison + FAQ + CTA
- [x] `/blog` — the three draft posts + note
- [x] `/contact` — 3 option cards + CTA

## Cross-cutting v2 changes

- [x] Hero panel = full-width section; DASHANAN OS + robot cards move to a
      row beneath; chute slowed (SPEED 46→30, SPAWN 0.95→1.5)
- [x] Scoped light theme: `.theme-light` wrapper re-maps the CSS color tokens
      (ground↔cream etc.) so any section can flip light, beew-style
- [x] Robot is no longer "the Dashanan unit" — all mascot copy moved to the
      Nova concept-case framing
- [x] Nav/footer link to real routes; scroll-to-top on route change
- [x] SPA fallback note for static hosts (vercel.json / _redirects)

## Honesty rails (unchanged)

Aurora Robotics is a **fictional concept client, labeled as such on the page**.
Testimonials/pricing amounts/contact details remain placeholders flagged in
README. No invented client history or real-brand logos.
