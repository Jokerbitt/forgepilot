/**
 * Journey Companion — Phase 4.1: function proof.
 *
 * Goes beyond "build green": probes a running/deployed app's key routes and
 * produces a plain-German verdict ("App läuft — 3/3 Kernseiten antworten").
 * This turns "sollte gehen" into "nachweislich getestet".
 *
 * Pure here (planning + summary); the API does the HTTP probing.
 */

export interface ProbeResult {
  route: string
  status: number
  ok: boolean
  error?: string
}

export type ProofVerdict = 'works' | 'partial' | 'failed'

export interface ProofReport {
  verdict: ProofVerdict
  headline: string
  okCount: number
  total: number
  results: ProbeResult[]
}

/** Default routes to probe when none are given. */
export function defaultProbeRoutes(): string[] {
  return ['/']
}

/** Normalize + de-duplicate routes (each must start with "/"). */
export function normalizeRoutes(routes: string[] | undefined): string[] {
  const cleaned = (routes ?? [])
    .map(r => r.trim())
    .filter(Boolean)
    .map(r => (r.startsWith('/') ? r : `/${r}`))
  const unique = Array.from(new Set(cleaned))
  return unique.length ? unique : defaultProbeRoutes()
}

/** A probe counts as OK when the server answered without a 5xx error. */
export function isProbeOk(status: number): boolean {
  return status > 0 && status < 500
}

/** Summarize probe results into a plain-German verdict. */
export function summarizeProof(appName: string, results: ProbeResult[]): ProofReport {
  const total = results.length
  const okCount = results.filter(r => r.ok).length
  const name = appName.trim() || 'Die App'

  let verdict: ProofVerdict
  let headline: string
  if (total === 0) {
    verdict = 'failed'
    headline = 'Keine Seiten zum Prüfen.'
  } else if (okCount === total) {
    verdict = 'works'
    headline = `✅ ${name} läuft — alle ${total} geprüften Seiten antworten.`
  } else if (okCount === 0) {
    verdict = 'failed'
    headline = `❌ ${name} antwortet nicht — keine der ${total} geprüften Seiten lädt.`
  } else {
    verdict = 'partial'
    headline = `⚠️ ${name} läuft teilweise — ${okCount} von ${total} Seiten antworten.`
  }

  return { verdict, headline, okCount, total, results }
}
