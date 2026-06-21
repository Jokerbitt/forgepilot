/**
 * Cross-phase budget allocation (pure).
 *
 * A multi-phase plan can carry a single overall budget. This splits that budget
 * across the phases weighted by their estimated effort (`estimatedTurns`), so a
 * heavier phase gets more room and the phases together stay within the total —
 * instead of every phase getting a fixed tier independently.
 *
 * Pure + unit-testable; the plan executor feeds phase efforts in and uses the
 * per-phase amounts as each delegation's maxBudgetUsd.
 */

export interface BudgetPhase {
  /** Estimated effort for the phase (turns). Higher = larger share. */
  estimatedTurns: number
}

export interface BudgetAllocation {
  /** Per-phase budget in USD, same order as the input phases. */
  perPhaseUsd: number[]
  /** Sum of perPhaseUsd (after rounding). */
  totalUsd: number
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0)

/**
 * Split `totalBudgetUsd` across phases proportionally to their effort, with a
 * per-phase floor. Rounding/floor drift is absorbed by the highest-effort phase
 * so the per-phase amounts sum back to the budget.
 */
export function allocateBudget(
  totalBudgetUsd: number,
  phases: BudgetPhase[],
  minPerPhaseUsd = 0.5,
): BudgetAllocation {
  if (phases.length === 0) return { perPhaseUsd: [], totalUsd: 0 }
  if (!(totalBudgetUsd > 0)) return { perPhaseUsd: phases.map(() => 0), totalUsd: 0 }

  const weights = phases.map(p => Math.max(1, Math.floor(p.estimatedTurns) || 1))
  const totalWeight = sum(weights)

  const perPhaseUsd = weights.map(w => {
    const share = round2((totalBudgetUsd * w) / totalWeight)
    return Math.max(minPerPhaseUsd, share)
  })

  // Absorb rounding + floor drift on the largest-effort phase.
  const drift = round2(totalBudgetUsd - sum(perPhaseUsd))
  if (drift !== 0) {
    const biggest = weights.indexOf(Math.max(...weights))
    perPhaseUsd[biggest] = Math.max(minPerPhaseUsd, round2(perPhaseUsd[biggest] + drift))
  }

  return { perPhaseUsd, totalUsd: round2(sum(perPhaseUsd)) }
}
