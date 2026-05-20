/**
 * Scheduled Delegation Queue — Vercel Cron Job — M120
 *
 * GET  → return current queue stats (no auth required for monitoring)
 * POST → trigger auto-execution of up to 3 approved delegations
 *
 * Vercel Cron schedule: every 15 minutes (see vercel.json)
 * The POST endpoint validates the CRON_SECRET header.
 *
 * In local development, trigger manually:
 *   curl -X POST http://localhost:3000/api/cron/delegation-queue \
 *     -H "Authorization: Bearer <CRON_SECRET>"
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { type NextRequest, NextResponse } from 'next/server'
import { selectNextBatch, getQueueStats } from '@/lib/delegations/queue'
import { delegationLogger } from '@/lib/logger'

const MAX_BATCH      = 3
const MAX_CONCURRENT = 2

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    // Allow in non-production when no secret configured
    return process.env.NODE_ENV !== 'production'
  }
  return request.headers.get('authorization') === `Bearer ${secret}`
}

// ─── GET — queue status ───────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  const stats = getQueueStats()
  return NextResponse.json({ stats, timestamp: new Date().toISOString() })
}

// ─── POST — trigger execution batch ──────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    delegationLogger.warn({ event: 'cron.delegation-queue.unauthorized' })
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const batch = selectNextBatch({ max: MAX_BATCH, maxConcurrent: MAX_CONCURRENT })

  if (batch.length === 0) {
    delegationLogger.info({ event: 'cron.delegation-queue.empty', reason: 'no approved delegations or concurrency limit reached' })
    return NextResponse.json({ triggered: 0, message: 'No delegations to execute' })
  }

  delegationLogger.info({
    event: 'cron.delegation-queue.triggered',
    count: batch.length,
    ids: batch.map(d => d.id),
  })

  // Fire-and-forget execution requests for each selected delegation.
  // Uses the existing /api/delegations/[id]/execute route so all guards
  // (rate limiting, approval check, OTel spans, etc.) remain active.
  const origin = process.env.NEXTAUTH_URL
    ?? process.env.VERCEL_URL
    ?? 'http://localhost:3000'

  const results = await Promise.allSettled(
    batch.map(d =>
      fetch(`${origin}/api/delegations/${d.id}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }).then(r => ({ id: d.id, status: r.status })),
    ),
  )

  const triggered = results.filter(r => r.status === 'fulfilled').length
  const failed    = results.filter(r => r.status === 'rejected').length

  return NextResponse.json({
    triggered,
    failed,
    ids: batch.map(d => d.id),
    timestamp: new Date().toISOString(),
  })
}
