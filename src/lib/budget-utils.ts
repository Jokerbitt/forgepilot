/** Map budget USD → max turns for internal tooling. $1 → 15 turns, $5 → 40 turns, capped at 60. */
export function budgetToMaxTurns(budgetUsd: number): number {
  return Math.min(60, Math.max(5, Math.round(budgetUsd * 15)))
}

/**
 * M110: Realistic turn budget for Claude CLI. Feature phases need 40–200 turns.
 * Scale: ~40 turns per $1, minimum 40, no hard cap.
 * $1→40, $2→80, $3→120, $5→200, $10→400
 */
export function budgetToClaudeCliMaxTurns(budgetUsd: number): number {
  return Math.max(40, Math.round(budgetUsd * 40))
}

// ─── M110: Complexity-aware budget ────────────────────────────────────────────

export type TaskComplexity = 'small' | 'medium' | 'large'

export interface ComplexityEstimate {
  complexity: TaskComplexity
  /** Recommended minimum budget in USD */
  recommendedBudgetUsd: number
  /** Recommended max turns */
  recommendedTurns: number
  /** Human-readable label */
  label: string
  /** Why this complexity was chosen */
  reason: string
}

const COMPLEXITY_TURNS: Record<TaskComplexity, number> = {
  small:  35,
  medium: 70,
  large:  140,
}

const COMPLEXITY_BUDGET: Record<TaskComplexity, number> = {
  small:  1.0,
  medium: 3.0,
  large:  8.0,
}

/**
 * Estimate task complexity from DoD item count and goal length.
 * Used by the UI to show a complexity indicator and suggest a budget.
 *
 * Rules:
 *   large:  dodItems >= 6  OR  goal > 120 chars
 *   medium: dodItems >= 3  OR  goal > 60 chars
 *   small:  everything else
 */
export function estimateComplexity(
  dodItems: string[],
  goal: string,
  taskType?: string,
): ComplexityEstimate {
  const itemCount = dodItems.filter(d => d.trim().length > 0).length
  const goalLen = goal.trim().length

  // Large feature types always get at least medium
  const isLargeType = taskType === 'large-feature' || taskType === 'feature'

  let complexity: TaskComplexity
  let reason: string

  if (itemCount >= 6 || goalLen > 120 || taskType === 'large-feature') {
    complexity = 'large'
    reason = itemCount >= 6 ? `${itemCount} DoD-Items` : goalLen > 120 ? 'Detailed goal description' : 'Large feature type'
  } else if (itemCount >= 3 || goalLen > 60 || isLargeType) {
    complexity = 'medium'
    reason = itemCount >= 3 ? `${itemCount} DoD-Items` : goalLen > 60 ? 'Medium-length goal' : 'Feature type'
  } else {
    complexity = 'small'
    reason = 'Simple task (≤2 DoD-Items, short goal)'
  }

  const labels: Record<TaskComplexity, string> = {
    small:  `Klein (~${COMPLEXITY_TURNS.small} Turns, $${COMPLEXITY_BUDGET.small.toFixed(0)})`,
    medium: `Mittel (~${COMPLEXITY_TURNS.medium} Turns, $${COMPLEXITY_BUDGET.medium.toFixed(0)})`,
    large:  `Groß (~${COMPLEXITY_TURNS.large} Turns, $${COMPLEXITY_BUDGET.large.toFixed(0)})`,
  }

  return {
    complexity,
    recommendedBudgetUsd: COMPLEXITY_BUDGET[complexity],
    recommendedTurns: COMPLEXITY_TURNS[complexity],
    label: labels[complexity],
    reason,
  }
}

/**
 * Scale turns for the given complexity level.
 * Replaces the hard cap of 60 for large-feature delegations.
 */
export function budgetToClaudeCliMaxTurnsByComplexity(
  budgetUsd: number,
  complexity: TaskComplexity,
): number {
  const base = COMPLEXITY_TURNS[complexity]
  // Scale with budget within complexity band, but stay in reasonable range
  const scaled = Math.round(base + (budgetUsd - COMPLEXITY_BUDGET[complexity]) * 10)
  const min = base
  const max = complexity === 'large' ? 200 : complexity === 'medium' ? 100 : 60
  return Math.max(min, Math.min(max, Math.max(35, scaled)))
}
