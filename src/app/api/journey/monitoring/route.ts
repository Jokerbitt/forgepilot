export const dynamic = 'force-dynamic'

/**
 * POST /api/journey/monitoring
 * Body: { url: string, appName?: string, routes?: string[] }
 * Returns: OperationsReport (plain-German traffic-light health of a live app)
 *
 * Phase 4.3 — operations monitoring. Probes the key routes of a live/deployed
 * app WITH response times, rolls them into a 🟢/🟡/🔴 verdict, and tracks
 * consecutive outages across checks (monitoring-store). Reuses the function-proof
 * probing helpers so there is no parallel logic.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { normalizeRoutes, isProbeOk } from '@/lib/journey/function-proof'
import { summarizeOperations, type RouteCheck } from '@/lib/journey/monitoring'
import { getSnapshot, recordSnapshot } from '@/lib/journey/monitoring-store'

const PROBE_TIMEOUT_MS = 8000

export async function POST(req: NextRequest) {
  const authError = await requireAuth()
  if (authError) return authError

  let body: { url?: string; appName?: string; routes?: string[] }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Ungültiger Body' }, { status: 400 })
  }

  const rawUrl = body.url?.trim()
  if (!rawUrl) return NextResponse.json({ error: 'url ist erforderlich' }, { status: 400 })

  let base: URL
  try {
    base = new URL(/^https?:\/\//i.test(rawUrl) ? rawUrl : `http://${rawUrl}`)
  } catch {
    return NextResponse.json({ error: 'Ungültige URL' }, { status: 400 })
  }
  if (base.protocol !== 'http:' && base.protocol !== 'https:') {
    return NextResponse.json({ error: 'Nur http(s)-URLs werden unterstützt' }, { status: 400 })
  }

  const routes = normalizeRoutes(body.routes)
  const checks: RouteCheck[] = []
  for (const route of routes) {
    const target = new URL(route, base).toString()
    const start = Date.now()
    try {
      const res = await fetch(target, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) })
      checks.push({ route, status: res.status, ok: isProbeOk(res.status), latencyMs: Date.now() - start })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      checks.push({
        route,
        status: 0,
        ok: false,
        latencyMs: Date.now() - start,
        error: /timeout|abort/i.test(msg) ? 'Zeitüberschreitung' : 'nicht erreichbar',
      })
    }
  }

  const appUrl = base.origin
  const prevFailStreak = getSnapshot(appUrl)?.consecutiveFailures ?? 0
  const report = summarizeOperations(body.appName ?? 'Die App', checks, prevFailStreak)

  recordSnapshot({
    appUrl,
    status: report.status,
    okCount: report.okCount,
    total: report.total,
    avgLatencyMs: report.avgLatencyMs,
    consecutiveFailures: report.consecutiveFailures,
    checkedAt: new Date().toISOString(),
  })

  return NextResponse.json(report)
}
