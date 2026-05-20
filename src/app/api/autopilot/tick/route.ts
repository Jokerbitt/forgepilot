export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { getNBAConfig } from '@/lib/nba-engine/nba-config'
import type { Delegation } from '@/lib/models/delegation'
import type { RiskClass } from '@/lib/models/work-item'

const DELEGATIONS_FILE = path.join(process.cwd(), 'config', 'delegations.json')

const RISK_ORDER: Record<RiskClass, number> = { A: 0, B: 1, C: 2 }

function readDelegations(): Delegation[] {
  try {
    return JSON.parse(fs.readFileSync(DELEGATIONS_FILE, 'utf-8')) as Delegation[]
  } catch {
    return []
  }
}

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

  const delegations = readDelegations()
  const candidates = delegations.filter(d =>
    d.status === 'approved' &&
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
