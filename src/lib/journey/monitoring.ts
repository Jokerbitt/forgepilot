/**
 * Journey Companion — Phase 4.3: operations monitoring.
 *
 * Beyond the one-off "function proof" (4.1): treats a live app as something to
 * OPERATE. Probes its key routes WITH response times, rolls them up into a
 * plain-German traffic-light verdict (🟢 stabil / 🟡 eingeschränkt-oder-langsam
 * / 🔴 offline) and tracks consecutive failures so a real outage stands out
 * from a one-off blip. This turns ForgePilot from a generator into an operator.
 *
 * Pure here (latency classification + summary); the API does the HTTP probing
 * and persists snapshots via monitoring-store.
 */

export type OpsStatus = 'healthy' | 'degraded' | 'down'

export interface RouteCheck {
  route: string
  status: number
  ok: boolean
  latencyMs: number
  error?: string
}

export interface OperationsReport {
  status: OpsStatus
  headline: string
  okCount: number
  total: number
  avgLatencyMs: number
  slowestRoute: string | null
  /** Consecutive checks that found the app fully down (1 = first outage). */
  consecutiveFailures: number
  /** Plain-German detail line per route. */
  lines: string[]
}

/** A route slower than this (ms) is flagged as sluggish. */
export const SLOW_LATENCY_MS = 1500

/** Classify a single response time. */
export function classifyLatency(ms: number): 'fast' | 'ok' | 'slow' {
  if (ms >= SLOW_LATENCY_MS) return 'slow'
  if (ms >= 300) return 'ok'
  return 'fast'
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0
  return Math.round(nums.reduce((sum, n) => sum + n, 0) / nums.length)
}

/**
 * Roll route checks into a plain-German operations verdict.
 * `prevFailStreak` is the consecutive-failure count from the last check, so a
 * sustained outage can be called out instead of looking like a fresh blip.
 */
export function summarizeOperations(
  appName: string,
  checks: RouteCheck[],
  prevFailStreak = 0,
): OperationsReport {
  const name = appName.trim() || 'Die App'
  const total = checks.length
  const reachable = checks.filter(c => c.ok)
  const okCount = reachable.length
  const avgLatencyMs = avg(reachable.map(c => c.latencyMs))
  const slowest = reachable.reduce<RouteCheck | null>(
    (acc, c) => (acc && acc.latencyMs >= c.latencyMs ? acc : c),
    null,
  )
  const slowestRoute = slowest ? slowest.route : null

  let status: OpsStatus
  let headline: string
  if (total === 0) {
    status = 'down'
    headline = '🔴 Keine Seiten zum Prüfen — bitte erst eine Adresse angeben.'
  } else if (okCount === 0) {
    status = 'down'
    const streak = prevFailStreak + 1
    headline = `🔴 ${name} ist offline — keine der ${total} geprüften Seiten antwortet${streak > 1 ? ` (${streak} Prüfungen in Folge)` : ''}.`
  } else if (okCount < total) {
    status = 'degraded'
    headline = `🟡 ${name} läuft eingeschränkt — nur ${okCount} von ${total} Seiten antworten.`
  } else if (avgLatencyMs >= SLOW_LATENCY_MS) {
    status = 'degraded'
    headline = `🟡 ${name} läuft, ist aber langsam — Ø ${avgLatencyMs} ms (alle ${total} Seiten antworten).`
  } else {
    status = 'healthy'
    headline = `🟢 ${name} läuft stabil — alle ${total} Seiten antworten (Ø ${avgLatencyMs} ms).`
  }

  const consecutiveFailures = status === 'down' ? prevFailStreak + 1 : 0

  const lines = checks.map(c => {
    if (!c.ok) {
      return `✗ ${c.route} — ${c.status > 0 ? `HTTP ${c.status}` : c.error ?? 'nicht erreichbar'}`
    }
    const slow = c.latencyMs >= SLOW_LATENCY_MS ? ' · langsam' : ''
    return `✓ ${c.route} — HTTP ${c.status}, ${c.latencyMs} ms${slow}`
  })

  return { status, headline, okCount, total, avgLatencyMs, slowestRoute, consecutiveFailures, lines }
}
