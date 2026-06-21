/**
 * PR Status Sync — Vercel Cron Job — M264
 *
 * Called every 30 minutes by Vercel Cron (configured in vercel.json).
 * Fetches the GitHub PR state for all delegations that have an open prUrl
 * and updates prState + prMergedAt on the delegation report when the PR is merged.
 *
 * Only processes completed delegations with a prUrl where prState is not 'merged'.
 * Fail-open: individual PR fetch errors are logged and skipped.
 *
 * Cron schedule: 15 * * * * (15 min past every hour, offset from delegation-queue)
 */

import { type NextRequest, NextResponse } from 'next/server'
import { createDelegationRepository, SINGLE_TENANT_USER_ID } from '@/lib/repositories/delegationRepository'
import { fetchPRStatus } from '@/lib/github/pr-status'
import { logger } from '@/lib/logger'
import { isCronAuthorized } from '@/lib/cron/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface SyncResult {
  ok: boolean
  checked: number
  updated: number
  errors: number
  durationMs: number
}

async function runPRStatusSync(): Promise<SyncResult> {
  const start = Date.now()
  const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
  const all = await repo.listByStatus()

  // Only delegations with an open prUrl that haven't been marked merged
  const candidates = all.filter((d: import('@/lib/models/delegation').Delegation) =>
    d.summaryReport?.prUrl &&
    d.summaryReport.prState !== 'merged'
  )

  let updated = 0
  let errors = 0

  for (const d of candidates) {
    const prUrl = d.summaryReport!.prUrl!
    try {
      const status = await fetchPRStatus(prUrl)
      if (status.error) {
        logger.warn({ event: 'cron.pr_sync.fetch_error', delegationId: d.id, error: status.error })
        errors++
        continue
      }

      const prevState = d.summaryReport!.prState
      if (status.state !== prevState) {
        await repo.update(d.id, {
          summaryReport: {
            ...d.summaryReport!,
            prState: status.state,
            prMergedAt: status.state === 'merged' ? status.updatedAt : undefined,
          },
        })
        logger.info({
          event: 'cron.pr_sync.updated',
          delegationId: d.id,
          prUrl,
          from: prevState ?? 'open',
          to: status.state,
        })
        updated++

        // Loop-Closure: PR just merged → trigger next safe delegation in autopilot mode
        if (status.state === 'merged') {
          try {
            const { getNBAConfig } = await import('@/lib/nba-engine/nba-config')
            const config = getNBAConfig()
            if (config.approvalMode === 'autopilot') {
              const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
              fetch(`${baseUrl}/api/delegations/next-safe`, { method: 'POST' }).catch(() => {})
              logger.info({ event: 'cron.pr_sync.loop_next_triggered', delegationId: d.id })
            }
          } catch { /* non-critical */ }
        }
      }
    } catch (err) {
      logger.error({ event: 'cron.pr_sync.error', delegationId: d.id, error: String(err) })
      errors++
    }
  }

  return {
    ok: errors === 0,
    checked: candidates.length,
    updated,
    errors,
    durationMs: Date.now() - start,
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isCronAuthorized(request, 'pr-status-sync')) {
    logger.warn({ event: 'cron.pr_sync.unauthorized' })
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    logger.info({ event: 'cron.pr_sync.start' })
    const result = await runPRStatusSync()
    logger.info({ event: 'cron.pr_sync.done', ...result })
    return NextResponse.json(result)
  } catch (err) {
    logger.error({ event: 'cron.pr_sync.fatal', error: String(err) })
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}

// Allow manual trigger via POST (same auth)
export async function POST(request: NextRequest): Promise<NextResponse> {
  return GET(request)
}
