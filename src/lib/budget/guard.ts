import type { Delegation } from '@/lib/models/delegation'
import { createDelegationRepository, SINGLE_TENANT_USER_ID } from '@/lib/repositories/delegationRepository'
import { apiLogger } from '@/lib/logger'

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
export async function checkBudget(delegation: Delegation): Promise<BudgetCheckResult> {
  const limit = getBudgetLimit(delegation)
  const actual = delegation.actualCostUsd ?? delegation.costEstimateUsd ?? 0

  if (!limit) {
    return { exceeded: false, limit: null, actual }
  }

  if (actual <= limit) {
    return { exceeded: false, limit, actual }
  }

  const reason = `Budget exceeded: $${actual.toFixed(4)} > $${limit.toFixed(4)} limit`
  apiLogger.warn(
    { event: 'budget.exceeded', delegationId: delegation.id, actual, limit },
    reason,
  )

  // Update delegation to failed with budget error
  try {
    const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
    await repo.update(delegation.id, {
      status: 'failed',
      errorMessage: reason,
    })
  } catch (error) {
    apiLogger.error(
      { event: 'budget.update_failed', error: error instanceof Error ? error.message : String(error) },
      'Failed to update delegation status after budget exceeded',
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
  const limit = getBudgetLimit(delegation)
  if (!limit) return false
  return estimatedCostUsd > limit
}
