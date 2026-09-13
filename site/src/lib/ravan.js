/*
 * Opens the "Ask Ravan" panel from anywhere on the site. Every "book a
 * call" / contact CTA routes here now that the contact page is gone.
 */
export const RAVAN_OPEN = 'ravan:open'
export function openRavan() {
  window.dispatchEvent(new CustomEvent(RAVAN_OPEN))
}
