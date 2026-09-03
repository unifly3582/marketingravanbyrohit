// One line-icon per head, drawn on a 24x24 grid, stroke-based so they
// inherit currentColor and stay crisp at badge sizes.

const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }

export const HeadIcons = {
  agent: (
    <g {...P}>
      <rect x="5" y="7" width="14" height="11" rx="3" />
      <circle cx="9.5" cy="12" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="12" r="1.1" fill="currentColor" stroke="none" />
      <path d="M12 7V4M8.5 15.5c1 .9 6 .9 7 0" />
    </g>
  ),
  sdr: (
    <g {...P}>
      <path d="M4 6h16v10H9l-5 4z" />
      <path d="M8 10h8M8 13h5" />
    </g>
  ),
  voice: (
    <g {...P}>
      <path d="M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4" />
    </g>
  ),
  geo: (
    <g {...P}>
      <circle cx="11" cy="11" r="6" />
      <path d="M20 20l-4.2-4.2" />
      <path d="M11 8.2l.8 1.8 1.9.3-1.4 1.3.4 1.9-1.7-1-1.7 1 .4-1.9-1.4-1.3 1.9-.3z" fill="currentColor" stroke="none" />
    </g>
  ),
  erp: (
    <g {...P}>
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M15 3v4h4M9 12h7M9 15h7M9 9h3" />
    </g>
  ),
  ads: (
    <g {...P}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
    </g>
  ),
  bi: (
    <g {...P}>
      <path d="M4 20V10M10 20V4M16 20v-8M21 20H3" />
      <path d="M16 8l4-4" />
      <path d="M20 7V4h-3" />
    </g>
  ),
  uiux: (
    <g {...P}>
      <rect x="3" y="4" width="18" height="13" rx="2.5" />
      <path d="M3 9h18M8 21h8" />
      <path d="M12 13l2 2-2 .6z" fill="currentColor" stroke="none" />
    </g>
  ),
  api: (
    <g {...P}>
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <circle cx="12" cy="18" r="2.5" />
      <path d="M7.8 7.8L10.5 16M16.2 7.8L13.5 16M8.5 6h7" />
    </g>
  ),
  shield: (
    <g {...P}>
      <path d="M12 3l7 3v6c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V6z" />
      <path d="M9 12l2 2 4-4.5" />
    </g>
  ),
}

export function HeadIcon({ name, className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      {HeadIcons[name]}
    </svg>
  )
}

export function Arrow({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function Flame({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M12 2c.6 3-0.8 4.6-2.4 6.2C7.8 10 6 11.9 6 15a6 6 0 0 0 12 0c0-2.4-1.1-4-2.2-5.4-.4 1-.9 1.7-1.8 2.4.3-3.4-.6-7.5-2-10z"
        fill="currentColor"
      />
    </svg>
  )
}

export function Check({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M5 13l4 4L19 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function Cross({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}
