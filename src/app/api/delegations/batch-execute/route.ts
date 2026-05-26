export const dynamic = 'force-dynamic'
/**
 * POST /api/delegations/batch-execute
 *
 * Triggers execution for all approved delegations up to the configured
 * concurrency limit. Risk-C delegations are always skipped.
 *
 * Returns immediately — each execution runs in the background.
 */
import { NextResponse } from 'next/server'
import { createDelegationRepository, SINGLE_TENANT_USER_ID } from '@/lib/repositories/delegationRepository'
import { getNBAConfig } from '@/lib/nba-engine/nba-config'
import { apiLogger } from '@/lib/logger'

type SkipReason = 'riskClass C requires manual approval' | 'concurrency limit reached' | 'not approved'

type ItemResult =
  | { id: string; triggered: true }
  | { id: string; triggered: false; reason: SkipReason }

function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, '')
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'http://localhost:3000'
}

export async function POST(): Promise<NextResponse> {
  const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
  const config = getNBAConfig()
  const maxConcurrent = config.maxConcurrentAgents ?? 2

  const allDelegations = await repo.listByStatus(['approved'])
  const running = await repo.listByStatus(['running'])
  const availableSlots = Math.max(0, maxConcurrent - running.length)

  const results: ItemResult[] = []
  let triggered = 0

  for (const delegation of allDelegations) {
    if (delegation.contract.riskClass === 'C') {
      results.push({ id: delegation.id, triggered: false, reason: 'riskClass C requires manual approval' })
      continue
    }
    if (triggered >= availableSlots) {
      results.push({ id: delegation.id, triggered: false, reason: 'concurrency limit reached' })
      continue
    }

    const executeUrl = `${getBaseUrl()}/api/delegations/${delegation.id}/execute`
    void fetch(executeUrl, { method: 'POST' }).catch((err: unknown) => {
      apiLogger.warn({ event: 'batch-execute.trigger.failed', id: delegation.id, err }, 'Failed to trigger delegation execute')
    })

    triggered += 1
    results.push({ id: delegation.id, triggered: true })
    apiLogger.info({ event: 'batch-execute.triggered', id: delegation.id }, `Triggered delegation ${delegation.id}`)
  }

  const triggeredIds = results.filter(r => r.triggered).map(r => r.id)
  const skipped = results
    .filter((r): r is { id: string; triggered: false; reason: SkipReason } => !r.triggered)
    .map(r => ({ id: r.id, reason: r.reason }))

  return NextResponse.json({
    triggered: triggeredIds,
    skipped,
    count: triggeredIds.length,
    concurrencyLimit: maxConcurrent,
    slotsUsed: running.length,
  })
}
