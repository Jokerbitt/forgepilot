/**
 * DSGVO Retention Cleanup — Vercel Cron Job — M99
 *
 * Called daily at 02:00 UTC by Vercel Cron (configured in vercel.json).
 * Deletes processing records older than the configured retention period (default: 5 years).
 *
 * Security: validates Authorization header to prevent unauthorized invocations.
 * Set CRON_SECRET in Vercel environment variables (a long random string).
 *
 * Cron schedule: 0 2 * * * (daily at 02:00 UTC)
 */

import { type NextRequest, NextResponse } from 'next/server'
import { runRetentionCleanup } from '@/lib/dsgvo/processing-ledger'
import { dsgvoLogger } from '@/lib/logger'

export const runtime = 'nodejs'

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Validate Vercel Cron authorization
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${cronSecret}`) {
      dsgvoLogger.warn({ event: 'cron.retention.unauthorized' })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  } else if (process.env.NODE_ENV === 'production') {
    // In production, CRON_SECRET must be set
    dsgvoLogger.error({ event: 'cron.retention.no_secret', env: 'production' })
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  }

  try {
    dsgvoLogger.info({ event: 'cron.retention.start' })
    const result = await runRetentionCleanup()
    dsgvoLogger.info({ event: 'cron.retention.complete', ...result })

    return NextResponse.json({
      ok: true,
      deletedCount: result.deletedCount,
      retainedCount: result.retainedCount,
      ranAt: new Date().toISOString(),
    })
  } catch (err) {
    dsgvoLogger.error({
      event: 'cron.retention.error',
      error: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json({ error: 'Retention cleanup failed' }, { status: 500 })
  }
}
