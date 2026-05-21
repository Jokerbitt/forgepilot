/**
 * Connector Auto-Sync — Vercel Cron Job — M8 AP8.2
 *
 * Pulls work items from Linear + GitHub every 15 minutes and writes a
 * snapshot to `config/work-items-cache.json`. The UI can read the cache
 * for instant responses without hitting remote APIs on every page load.
 *
 * Security: requires `Authorization: Bearer <CRON_SECRET>` in production.
 * In development the route is unauthenticated to ease manual testing.
 *
 * Cron schedule: every 15 minutes.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { syncAllConnectors } from '@/lib/connectors/sync'
import { logger } from '@/lib/logger'
import { isCronAuthorized } from '@/lib/cron/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function runSync(request: NextRequest): Promise<NextResponse> {
  if (!isCronAuthorized(request, 'connector-sync')) {
    logger.warn({ event: 'cron.connector-sync.unauthorized' })
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    logger.info({ event: 'cron.connector-sync.start' })
    const cache = await syncAllConnectors()

    logger.info({
      event: 'cron.connector-sync.complete',
      totalItems: cache.items.length,
      durationMs: cache.durationMs,
      results: cache.results,
    })

    return NextResponse.json({
      ok: true,
      syncedAt: cache.syncedAt,
      durationMs: cache.durationMs,
      totalItems: cache.items.length,
      results: cache.results,
    })
  } catch (err) {
    logger.error({
      event: 'cron.connector-sync.error',
      error: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json({ error: 'Connector sync failed' }, { status: 500 })
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return runSync(request)
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return runSync(request)
}
