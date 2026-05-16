import type { AgentLog, Delegation } from '@/lib/models/delegation'

export interface ExecutionStartBlocker {
  status: 400 | 403
  error: string
}

export function getExecutionStartBlocker(delegation: Delegation): ExecutionStartBlocker | undefined {
  if (delegation.status !== 'approved') {
    return {
      status: 400,
      error: `Delegation kann nicht gestartet werden — Status ist '${delegation.status}', muss 'approved' sein.`,
    }
  }

  if (delegation.contract.riskClass === 'C' && delegation.contract.requiresApproval) {
    return {
      status: 403,
      error: 'RiskClass C: Manuelle Freigabe erforderlich. Setze requiresApproval=false nach bewusstem Review.',
    }
  }

  return undefined
}

export function buildExecutionStartLog(delegation: Delegation): AgentLog {
  const budgetNote = delegation.contract.maxBudgetUsd > 0
    ? ` | Budget: $${delegation.contract.maxBudgetUsd.toFixed(2)}`
    : ''

  return {
    timestamp: new Date().toISOString(),
    type: 'info',
    message: `Ausfuehrung gestartet${budgetNote}`,
  }
}

export function buildSimulationBudgetLog(delegation: Delegation): Pick<AgentLog, 'type' | 'message'> {
  const budget = delegation.contract.maxBudgetUsd
  const estimate = delegation.costEstimateUsd

  if (estimate > budget) {
    return {
      type: 'error',
      message: `Kosten-Schaetzung ($${estimate.toFixed(2)}) ueberschreitet Budget ($${budget.toFixed(2)})`,
    }
  }

  return {
    type: 'info',
    message: `Budget: $${budget.toFixed(2)} | Schaetzung: $${estimate.toFixed(2)}`,
  }
}
