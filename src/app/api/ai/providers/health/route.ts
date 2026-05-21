/**
 * GET  /api/ai/providers/health  — return cached health report (fast)
 * POST /api/ai/providers/health  — run a fresh health check on all providers
 */

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { runHealthCheck, getCachedHealthReport } from '@/lib/ai/providers/health-monitor'
import { logger } from '@/lib/logger'

const log = logger.child({ module: 'api.ai.providers.health' })

export async function GET() {
  const report = getCachedHealthReport()
  if (!report) {
    return NextResponse.json({ checkedAt: null, providers: [], summary: { total: 0, healthy: 0, degraded: 0, unavailable: 0, unconfigured: 0 } })
  }
  return NextResponse.json(report)
}

export async function POST() {
  try {
    const report = await runHealthCheck()
    return NextResponse.json(report)
  } catch (err) {
    log.error({ event: 'api.providers.health.error', error: err instanceof Error ? err.message : String(err) })
    return NextResponse.json({ error: 'Health check failed' }, { status: 500 })
  }
}
