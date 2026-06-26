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
 * In-flight budget guard: decide, from the cost accumulated SO FAR mid-run (e.g.
 * the `total_cost_usd` of a stream `result` event), whether the runner must kill
 * the agent NOW to stop it blowing past the budget. Pure + unit-tested — the
 * runner stays a thin shell that just acts on the verdict.
 *
 * Honors the same enforcement settings as the post-hoc `checkBudget`
 * (off → never kill; tolerant → raise the cap by the tolerance %). Returns the
 * effective limit so the caller can log it.
 */
export function inflightBudgetExceeded(
  costSoFarUsd: number,
  rawLimitUsd: number | null,
): { exceeded: boolean; limit: number | null } {
  const limit = effectiveBudgetLimit(rawLimitUsd)
  if (limit == null) return { exceeded: false, limit: null }
  if (!Number.isFinite(costSoFarUsd) || costSoFarUsd <= 0) return { exceeded: false, limit }
  return { exceeded: costSoFarUsd > limit, limit }
}

/**
 * Pull a cumulative USD cost out of a streamed runner event, trying the field
 * names different CLIs use. Claude CLI emits `total_cost_usd`; Codex's JSON event
 * stream is less fixed, so we also probe `cost_usd` / `total_cost` / `cost` and one
 * level into a nested `usage` / `info` object. Returns a positive number or
 * undefined (no cost in this event → the in-flight guard simply doesn't fire on it,
 * and the wall-clock timeout remains the backstop).
 */
export function extractCostUsdFromEvent(event: Record<string, unknown>): number | undefined {
  const pick = (obj: unknown): number | undefined => {
    if (!obj || typeof obj !== 'object') return undefined
    const rec = obj as Record<string, unknown>
    for (const key of ['total_cost_usd', 'cost_usd', 'total_cost', 'cost']) {
      const v = rec[key]
      if (typeof v === 'number' && Number.isFinite(v) && v > 0) return v
    }
    return undefined
  }
  return pick(event) ?? pick(event.usage) ?? pick(event.info)
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
