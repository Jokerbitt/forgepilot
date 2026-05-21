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
import { isCronAuthorized } from '@/lib/cron/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Validate Vercel Cron authorization
  if (!isCronAuthorized(request, 'retention')) {
    dsgvoLogger.warn({ event: 'cron.retention.unauthorized' })
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    dsgvoLogger.info({ event: 'cron.retention.start' })
    const result = await runRetentionCleanup()
    dsgvoLogger.info({ event: 'cron.retention.complete', ...result })

    return NextResponse.json({
      ok: true,
      deletedCount: result.deleted,
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
