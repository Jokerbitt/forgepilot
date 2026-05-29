import type { Delegation } from '@/lib/models/delegation'

export type DeliveryCycleActionType =
  | 'quality_check'
  | 'critic_review'
  | 'create_pr'
  | 'review_pr'
  | 'repair_required'

export interface DeliveryCycleAction {
  type: DeliveryCycleActionType
  delegation: Delegation
  reason: string
}

function updatedAtTime(delegation: Delegation): number {
  return new Date(delegation.updatedAt || delegation.completedAt || delegation.createdAt).getTime()
}

function isDeliverableRisk(delegation: Delegation): boolean {
  return delegation.contract.riskClass !== 'C'
}

export function getDeliveryActionForDelegation(delegation: Delegation): DeliveryCycleAction | null {
  if (delegation.status !== 'completed') return null
  if (!isDeliverableRisk(delegation)) return null

  if (delegation.qualityCheck?.verdict === 'failed') {
    return {
      type: 'repair_required',
      delegation,
      reason: 'DoD Quality Check ist fehlgeschlagen. Erst Reparatur-Delegation oder Scope-Korrektur erstellen.',
    }
  }

  if (!delegation.qualityCheck) {
    return {
      type: 'quality_check',
      delegation,
      reason: 'Abgeschlossene Delegation braucht einen DoD Quality Check.',
    }
  }

  if (delegation.qualityCheck.verdict === 'partial') {
    return {
      type: 'repair_required',
      delegation,
      reason: 'DoD Quality Check ist nur teilweise bestanden. Erst offene Kriterien reparieren.',
    }
  }

  if (!delegation.criticScore) {
    return {
      type: 'critic_review',
      delegation,
      reason: 'Abgeschlossene Delegation braucht eine Critic-Bewertung.',
    }
  }

  if (delegation.criticScore.verdict !== 'approved') {
    return {
      type: 'repair_required',
      delegation,
      reason: 'Critic Review hat die Delegation nicht freigegeben. Erst Reparatur oder manuelle Entscheidung.',
    }
  }

  if (!delegation.summaryReport?.prUrl) {
    return {
      type: 'create_pr',
      delegation,
      reason: 'Abgeschlossene Delegation hat noch keinen PR-Link.',
    }
  }

  if (delegation.summaryReport.prState !== 'merged') {
    return {
      type: 'review_pr',
      delegation,
      reason: 'PR ist vorhanden und wartet auf Review, Checks oder Merge-Entscheidung.',
    }
  }

  return null
}

export function pickNextDeliveryAction(delegations: Delegation[]): DeliveryCycleAction | null {
  return delegations
    .map(getDeliveryActionForDelegation)
    .filter((action): action is DeliveryCycleAction => Boolean(action))
    .sort((a, b) => {
      const rank: Record<DeliveryCycleActionType, number> = {
        repair_required: 0,
        quality_check: 1,
        critic_review: 2,
        create_pr: 3,
        review_pr: 4,
      }
      const rankDiff = rank[a.type] - rank[b.type]
      if (rankDiff !== 0) return rankDiff
      return updatedAtTime(b.delegation) - updatedAtTime(a.delegation)
    })[0] ?? null
}

export function describeDeliveryAction(action: DeliveryCycleAction | null): string {
  if (!action) return 'Alle abgeschlossenen Delegationen sind aktuell verarbeitet.'
  const title = action.delegation.title || action.delegation.contract.goal
  if (action.type === 'quality_check') return `Quality Check starten: ${title}`
  if (action.type === 'critic_review') return `Critic Review starten: ${title}`
  if (action.type === 'create_pr') return `PR erstellen: ${title}`
  if (action.type === 'review_pr') return `PR pruefen: ${title}`
  return `Reparatur erforderlich: ${title}`
}
