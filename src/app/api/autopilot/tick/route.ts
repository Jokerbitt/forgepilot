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
 * and fires execute requests for each. Called by the AutopilotRunner component
 * on a timer when approvalMode === 'autopilot'.
 */
export async function POST(request: Request) {
  const config = getNBAConfig()

  if (config.approvalMode !== 'autopilot') {
    return NextResponse.json({ skipped: true, reason: 'approvalMode is not autopilot' })
  }

  const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
  const approved = await repo.listByStatus(['approved'])
  const candidates = approved.filter(d =>
    riskWithinLimit(d.contract.riskClass, config.autopilotMaxRiskClass) &&
    d.contract.riskClass !== 'C',
  )

  if (candidates.length === 0) {
    return NextResponse.json({ triggered: [], count: 0 })
  }

  const baseUrl = new URL(request.url).origin
  const triggered: string[] = []

  for (const delegation of candidates) {
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
  }

  return NextResponse.json({ triggered, count: triggered.length })
}
