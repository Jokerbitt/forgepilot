/**
 * Journey Companion — Phase 3.3: share a built app via a link.
 *
 * Normalizes/validates a deploy URL and flags localhost URLs (only reachable on
 * the user's own machine) so a non-techie knows they need a Vercel/Docker deploy
 * for real sharing. Pure helpers.
 */

export interface ShareLink {
  valid: boolean
  url: string
  /** True for localhost / 127.0.0.1 / LAN IPs — not publicly reachable. */
  isLocal: boolean
  /** Plain-German note about reachability. */
  note: string
}

const LOCAL_HOST_RE = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/i

/** Normalize + validate a deploy URL into a shareable link with a reachability note. */
export function toShareLink(input: string): ShareLink {
  const raw = (input ?? '').trim()
  if (!raw) return { valid: false, url: '', isLocal: false, note: 'Keine URL angegeben.' }

  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
  let parsed: URL
  try {
    parsed = new URL(withScheme)
  } catch {
    return { valid: false, url: raw, isLocal: false, note: 'Das sieht nicht wie eine gültige Adresse aus.' }
  }

  const isLocal = LOCAL_HOST_RE.test(parsed.hostname)
  const note = isLocal
    ? 'Diese Adresse ist nur auf deinem Rechner/Netzwerk erreichbar. Für echtes Teilen die App über Vercel oder Docker live schalten.'
    : 'Diese Adresse ist öffentlich erreichbar — du kannst sie teilen.'

  return { valid: true, url: parsed.toString(), isLocal, note }
}
