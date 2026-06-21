import type { Delegation } from '@/lib/models/delegation'
import { createDelegationRepository, SINGLE_TENANT_USER_ID } from '@/lib/repositories/delegationRepository'
import { apiLogger } from '@/lib/logger'
import { getNBAConfig } from '@/lib/nba-engine/nba-config'

export interface BudgetCheckResult {
  exceeded: boolean
  limit: number | null
  actual: number
  reason?: string
}

export function getBudgetLimit(delegation: Delegation): number | null {
  const limit = delegation.contract?.maxCostUsd ?? delegation.contract?.maxBudgetUsd
  return typeof limit === 'number' && limit > 0 ? limit : null
}

/**
 * Check if a delegation has exceeded its budget.
 * If exceeded, updates delegation status to 'failed' with error message and notifies operator.
 * Never throws.
 */
/**
 * Resolve the EFFECTIVE budget limit given the user's enforcement settings.
 * Returns null when enforcement is 'off' (no cap), or the limit raised by the
 * tolerance percentage when 'tolerant'.
 */
export function effectiveBudgetLimit(rawLimit: number | null): number | null {
  if (rawLimit == null) return null
  const cfg = getNBAConfig()
  if (cfg.budgetEnforcement === 'off') return null
  if (cfg.budgetEnforcement === 'tolerant') {
    const pct = Math.max(0, cfg.budgetTolerancePct ?? 0)
    return rawLimit * (1 + pct / 100)
  }
  return rawLimit // strict
}

export async function checkBudget(delegation: Delegation): Promise<BudgetCheckResult> {
  const rawLimit = getBudgetLimit(delegation)
  const actual = delegation.actualCostUsd ?? delegation.costEstimateUsd ?? 0
  const limit = effectiveBudgetLimit(rawLimit)

  if (!limit) {
    // enforcement 'off' or no contract limit → never stop
    return { exceeded: false, limit: null, actual }
  }

  if (actual <= limit) {
    return { exceeded: false, limit, actual }
  }

  const overPct = rawLimit ? Math.round(((actual - rawLimit) / rawLimit) * 100) : 0
  const reason = `Budget pausiert: $${actual.toFixed(4)} überschreitet das Limit $${rawLimit?.toFixed(2)} um ${overPct}% (Toleranzgrenze $${limit.toFixed(2)}). Mit höherem Budget fortsetzbar.`
  apiLogger.warn(
    { event: 'budget.paused', delegationId: delegation.id, actual, limit, rawLimit },
    reason,
  )

  // Budget stop is NOT a real failure — mark it as budget-paused so the UI can
  // offer "resume with more budget" instead of treating it as broken.
  try {
    const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
    await repo.update(delegation.id, {
      status: 'failed',
      errorMessage: reason,
      budgetPaused: true,
      budgetPausedReason: reason,
    })
  } catch (error) {
    apiLogger.error(
      { event: 'budget.update_failed', error: error instanceof Error ? error.message : String(error) },
      'Failed to update delegation status after budget paused',
    )
  }

  // Send notification
  try {
    const { notifyExecutionResult } = await import('@/lib/notifications')
    await notifyExecutionResult({
      delegation: { ...delegation, status: 'failed', errorMessage: reason },
      event: 'failed',
    })
  } catch { /* notification failure is non-critical */ }

  return { exceeded: true, limit, actual, reason }
}

/**
 * Estimate whether a planned execution would exceed budget.
 * Used before starting execution to warn operator.
 */
export function wouldExceedBudget(
  delegation: Delegation,
  estimatedCostUsd: number,
): boolean {
  const limit = effectiveBudgetLimit(getBudgetLimit(delegation))
  if (!limit) return false
  return estimatedCostUsd > limit
}
