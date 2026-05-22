export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getNBAConfig } from '@/lib/nba-engine/nba-config'
import type { RiskClass } from '@/lib/models/work-item'
import { createDelegationRepository, SINGLE_TENANT_USER_ID } from '@/lib/repositories/delegationRepository'

const RISK_ORDER: Record<RiskClass, number> = { A: 0, B: 1, C: 2 }

function riskWithinLimit(actual: RiskClass, max: RiskClass): boolean {
  return RISK_ORDER[actual] <= RISK_ORDER[max]
}

/**
 * Autopilot tick: finds approved delegations that qualify for auto-execution
 * and fires execute requests for each up to maxConcurrentAgents.
 * Called by the AutopilotRunner component on a timer when approvalMode === 'autopilot'.
 *
 * G5: Respects maxConcurrentAgents — won't start more runs than the configured limit.
 * Fires eligible delegations in parallel (Promise.all) instead of serially.
 */
export async function POST(request: Request) {
  const config = getNBAConfig()

  if (config.approvalMode !== 'autopilot') {
    return NextResponse.json({ skipped: true, reason: 'approvalMode is not autopilot' })
  }

  const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)

  // G5: Respect maxConcurrentAgents — count currently running delegations
  const running = await repo.listByStatus(['running'])
  const runningCount = running.length
  const maxConcurrent = config.maxConcurrentAgents ?? 2
  const slotsAvailable = Math.max(0, maxConcurrent - runningCount)

  if (slotsAvailable === 0) {
    return NextResponse.json({
      triggered: [],
      count: 0,
      skipped: 0,
      runningCount,
      reason: `maxConcurrentAgents (${maxConcurrent}) reached`,
    })
  }

  const approved = await repo.listByStatus(['approved'])
  const candidates = approved.filter(d =>
    riskWithinLimit(d.contract.riskClass, config.autopilotMaxRiskClass) &&
    d.contract.riskClass !== 'C',
  )

  if (candidates.length === 0) {
    return NextResponse.json({ triggered: [], count: 0, skipped: 0, runningCount })
  }

  // Only trigger up to available slots
  const toTrigger = candidates.slice(0, slotsAvailable)
  const skipped = candidates.length - toTrigger.length

  const baseUrl = new URL(request.url).origin
  const triggered: string[] = []

  await Promise.all(
    toTrigger.map(async (delegation) => {
      try {
        const res = await fetch(`${baseUrl}/api/delegations/${delegation.id}/execute`, {
          method: 'POST',
        })
        if (res.ok) {
          triggered.push(delegation.id)
        }
      } catch {
        // one delegation failing should not block others
      }
    }),
  )

  return NextResponse.json({ triggered, count: triggered.length, skipped, runningCount })
}
