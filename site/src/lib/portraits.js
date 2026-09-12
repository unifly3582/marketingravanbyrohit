/*
 * The ten cut-out Ravan portraits, keyed by heads.js icon. Shared by the
 * hero deck and the "What we do" stage so both show the same character for
 * the same head. Take 3 of each is the locked-frame set (same head size,
 * shoulder line and chest cut for all ten, generated against a composition
 * reference in scripts/gen-agents.mjs); takes 1 and 2 of the original seven
 * are the earlier free-framed looks, still on disk if a swap is wanted.
 */
const PORTRAITS = import.meta.glob('../assets/agents/*.webp', { eager: true, import: 'default' })

export const PICK = {
  uiux: 'uiux-3',
  ads: 'ads-3',
  social: 'social-3',
  campaign: 'campaign-3',
  sdr: 'sdr-3',
  voice: 'voice-3',
  ecom: 'ecom-3',
  erp: 'erp-3',
  agent: 'agent-3',
  geo: 'geo-3',
}

/* the persona each head plays on its card */
export const PERSONA = {
  uiux: 'The Artisan',
  ads: 'The Showman',
  social: 'The Storyteller',
  campaign: 'The Strategist',
  sdr: 'The Closer',
  voice: 'The Orator',
  ecom: 'The Merchant',
  erp: 'The Quartermaster',
  agent: 'The Operator',
  geo: 'The Sage',
}

export const portraitFor = (icon) => PORTRAITS[`../assets/agents/${PICK[icon] ?? icon + '-1'}.webp`]
