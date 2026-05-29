import { computeAutopilotScore } from '@/lib/nba-engine/autopilot-score'
import type { Delegation } from '@/lib/models/delegation'

const RISK_WEIGHT: Record<string, number> = { A: 1, B: 2, C: 3 }

export interface NextSafeResult {
  delegation: Delegation
  autopilotScore: number
  autopilotLabel: string
  reasons: string[]
  runningCount: number
  maxConcurrentAgents: number
}

/**
 * Find the best delegation to auto-start based on current NBA config:
 * - Must be status 'approved' or 'pending' with requiresApproval=false
 * - Risk class within configured limit
 * - Autopilot score >= configured minimum
 * - Sorted by autopilot score descending
 */
export function pickNextSafe(
  delegations: Delegation[],
  opts: {
    autopilotMinScore: number
    autopilotMaxRiskClass: string
    maxConcurrentAgents: number
  },
): { candidate: Delegation | null; runningCount: number } {
  const running = delegations.filter(d => d.status === 'running')
  const runningCount = running.length

  if (runningCount >= opts.maxConcurrentAgents) {
    return { candidate: null, runningCount }
  }

  const eligible = delegations.filter(d => {
    if (d.status !== 'approved' && !(d.status === 'pending' && !d.contract.requiresApproval)) {
      return false
    }
    const riskOk = (RISK_WEIGHT[d.contract.riskClass] ?? 99) <= (RISK_WEIGHT[opts.autopilotMaxRiskClass] ?? 1)
    if (!riskOk) return false

    const { score, canAutopilot } = computeAutopilotScore(d.contract)
    if (!canAutopilot || score < opts.autopilotMinScore) return false

    return true
  })

  if (eligible.length === 0) return { candidate: null, runningCount }

  eligible.sort((a, b) => {
    const scoreDiff = computeAutopilotScore(b.contract).score - computeAutopilotScore(a.contract).score
    if (scoreDiff !== 0) return scoreDiff
    return (b.priority ?? 0) - (a.priority ?? 0)
  })

  return { candidate: eligible[0], runningCount }
}
