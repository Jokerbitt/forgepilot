/**
 * Delegation Health Monitor — M133
 *
 * Pure-function diagnostics over the delegation store. Flags delegations
 * that are stuck, hanging, over-budget, or waiting on a forgotten approval,
 * and recommends a concrete next action (retry / approve / cancel / wait).
 *
 * Designed to be called by:
 *  - `/api/delegations/health` (read-only snapshot for dashboards)
 *  - the autonomy loop (so the system can self-heal stuck queues)
 *  - the cron that already triggers `/api/cron/delegation-queue`
 */

import type { Delegation } from '@/lib/models/delegation'

/** Health classification — coarse bucket the UI groups by. */
export type DelegationHealthStatus =
  | 'healthy'
  | 'stuck'
  | 'attention'
  | 'failed-retry-eligible'
  | 'budget-exceeded'

/** Why a delegation got flagged. Each reason is independent and may stack. */
export type HealthReasonKind =
  | 'running-silent'
  | 'pending-approval-forgotten'
  | 'approved-never-started'
  | 'failed-no-feedback'
  | 'failed-with-known-pattern'
  | 'budget-over-soft-cap'
  | 'budget-over-hard-cap'

export interface HealthReason {
  kind: HealthReasonKind
  message: string
}

export type HealthRecommendation = 'retry' | 'cancel' | 'check-logs' | 'approve' | 'wait'

export interface DelegationHealth {
  delegationId: string
  title: string
  status: DelegationHealthStatus
  ageMinutes: number
  /** Minutes since the last update — only set when status is `running`. */
  silentMinutes?: number
  reasons: HealthReason[]
  recommendation?: HealthRecommendation
}

export interface FleetHealth {
  generatedAt: string
  total: number
  byStatus: Record<DelegationHealthStatus, number>
  flagged: DelegationHealth[]
}

// ─── Tuneable thresholds ─────────────────────────────────────────────────────

export interface HealthThresholds {
  /** Running delegation has not updated for this many minutes → `stuck`. */
  runningSilentMinutes: number
  /** Pending approval older than this → `attention`. */
  pendingApprovalMinutes: number
  /** Approved but not started for this long → `attention`. */
  approvedIdleMinutes: number
  /** actualCostUsd > budget * softMultiplier → reason `budget-over-soft-cap`. */
  budgetSoftMultiplier: number
  /** actualCostUsd > budget * hardMultiplier → status `budget-exceeded`. */
  budgetHardMultiplier: number
}

export const DEFAULT_THRESHOLDS: HealthThresholds = {
  runningSilentMinutes: 30,
  pendingApprovalMinutes: 60,
  approvedIdleMinutes: 240,
  budgetSoftMultiplier: 1.0,
  budgetHardMultiplier: 1.5,
}

// ─── Failure-pattern matching (mirrors lib/delegations/retry) ────────────────

/**
 * Error messages that mean the delegation can usually be retried without
 * human intervention (transient cloud errors, rate limits, etc.).
 */
const RETRYABLE_ERROR_PATTERNS: RegExp[] = [
  /ECONNRESET/i,
  /ETIMEDOUT/i,
  /timeout/i,
  /rate limit/i,
  /429/,
  /503/,
  /502/,
  /ENOTFOUND/i,
  /socket hang up/i,
]

function looksRetryable(errorMessage: string): boolean {
  return RETRYABLE_ERROR_PATTERNS.some(re => re.test(errorMessage))
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function minutesBetween(later: Date | string, earlier: Date | string): number {
  const a = typeof later === 'string' ? new Date(later).getTime() : later.getTime()
  const b = typeof earlier === 'string' ? new Date(earlier).getTime() : earlier.getTime()
  return Math.max(0, Math.round((a - b) / 60_000))
}

function emptyByStatus(): Record<DelegationHealthStatus, number> {
  return {
    healthy: 0,
    stuck: 0,
    attention: 0,
    'failed-retry-eligible': 0,
    'budget-exceeded': 0,
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Analyse a single delegation. Pure function — no I/O.
 *
 * @param delegation the delegation under review
 * @param now anchor timestamp (injected so tests are deterministic)
 * @param thresholds override the defaults if you want stricter / looser rules
 */
export function analyzeDelegationHealth(
  delegation: Delegation,
  now: Date,
  thresholds: HealthThresholds = DEFAULT_THRESHOLDS,
): DelegationHealth {
  const reasons: HealthReason[] = []
  const ageMinutes = minutesBetween(now, delegation.createdAt)
  const silentMinutes = delegation.status === 'running'
    ? minutesBetween(now, delegation.updatedAt)
    : undefined

  let status: DelegationHealthStatus = 'healthy'
  let recommendation: HealthRecommendation | undefined

  // ── Status-specific checks ─────────────────────────────────────────────
  if (delegation.status === 'running' && silentMinutes !== undefined) {
    if (silentMinutes >= thresholds.runningSilentMinutes) {
      reasons.push({
        kind: 'running-silent',
        message: `Running for ${silentMinutes}m without updates`,
      })
      status = 'stuck'
      recommendation = 'check-logs'
    }
  }

  if (delegation.status === 'pending' && delegation.contract.requiresApproval) {
    if (ageMinutes >= thresholds.pendingApprovalMinutes) {
      reasons.push({
        kind: 'pending-approval-forgotten',
        message: `Awaiting approval for ${ageMinutes}m`,
      })
      status = 'attention'
      recommendation = 'approve'
    }
  }

  if (delegation.status === 'approved') {
    if (ageMinutes >= thresholds.approvedIdleMinutes) {
      reasons.push({
        kind: 'approved-never-started',
        message: `Approved ${ageMinutes}m ago but never started`,
      })
      status = 'attention'
      recommendation = 'check-logs'
    }
  }

  if (delegation.status === 'failed') {
    const err = delegation.errorMessage ?? ''
    if (!err) {
      reasons.push({
        kind: 'failed-no-feedback',
        message: 'Failed without an error message — needs manual inspection',
      })
      status = 'attention'
      recommendation = 'check-logs'
    } else if (looksRetryable(err)) {
      reasons.push({
        kind: 'failed-with-known-pattern',
        message: `Failure matches a transient pattern: ${err.slice(0, 120)}`,
      })
      status = 'failed-retry-eligible'
      recommendation = 'retry'
    } else {
      reasons.push({
        kind: 'failed-no-feedback',
        message: `Failed with: ${err.slice(0, 120)}`,
      })
      status = 'attention'
      recommendation = 'check-logs'
    }
  }

  // ── Budget overrun is orthogonal to status — can stack on top ──────────
  const budget = delegation.contract.maxBudgetUsd ?? 0
  const actual = delegation.actualCostUsd ?? 0
  if (budget > 0 && actual > 0) {
    if (actual > budget * thresholds.budgetHardMultiplier) {
      reasons.push({
        kind: 'budget-over-hard-cap',
        message: `Actual cost $${actual.toFixed(4)} exceeds ${thresholds.budgetHardMultiplier}× budget ($${budget.toFixed(2)})`,
      })
      status = 'budget-exceeded'
      recommendation = recommendation ?? 'cancel'
    } else if (actual > budget * thresholds.budgetSoftMultiplier) {
      reasons.push({
        kind: 'budget-over-soft-cap',
        message: `Actual cost $${actual.toFixed(4)} is over budget ($${budget.toFixed(2)})`,
      })
      // Soft cap only nudges the status upward if we were healthy.
      if (status === 'healthy') {
        status = 'attention'
        recommendation = 'check-logs'
      }
    }
  }

  return {
    delegationId: delegation.id,
    title: delegation.title,
    status,
    ageMinutes,
    silentMinutes,
    reasons,
    recommendation,
  }
}

/**
 * Roll all delegations into a fleet snapshot. The `flagged` list contains
 * everything that is NOT healthy, sorted by severity (stuck/budget-exceeded
 * first, then attention, then retry-eligible).
 */
export function analyzeFleetHealth(
  delegations: Delegation[],
  now: Date,
  thresholds: HealthThresholds = DEFAULT_THRESHOLDS,
): FleetHealth {
  const byStatus = emptyByStatus()
  const all = delegations.map(d => analyzeDelegationHealth(d, now, thresholds))

  for (const item of all) {
    byStatus[item.status] += 1
  }

  const severity: Record<DelegationHealthStatus, number> = {
    'budget-exceeded': 4,
    stuck: 3,
    attention: 2,
    'failed-retry-eligible': 1,
    healthy: 0,
  }

  const flagged = all
    .filter(item => item.status !== 'healthy')
    .sort((a, b) => severity[b.status] - severity[a.status] || b.ageMinutes - a.ageMinutes)

  return {
    generatedAt: now.toISOString(),
    total: delegations.length,
    byStatus,
    flagged,
  }
}
