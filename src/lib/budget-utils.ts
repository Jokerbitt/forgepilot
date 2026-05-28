/** Map budget USD → max turns for claude CLI. $1 → 15 turns, $5 → 40 turns, capped at 60. */
export function budgetToMaxTurns(budgetUsd: number): number {
  return Math.min(60, Math.max(5, Math.round(budgetUsd * 15)))
}

/**
 * Claude Code needs enough turns to explore, edit, verify, commit, and create a PR.
 * Very small budgets are still enforced by the budget guard, but the CLI needs enough
 * room to explore, edit, verify, commit and create a PR for one narrow real task.
 */
export function budgetToClaudeCliMaxTurns(budgetUsd: number): number {
  return Math.max(35, budgetToMaxTurns(budgetUsd))
}

/** Complexity tiers based on DoD items + goal length */
export type ComplexityTier = 'small' | 'medium' | 'large'

export function getComplexityTier(dodItems: string[], goal: string): ComplexityTier {
  const activeDod = dodItems.filter(d => d.trim().length > 0)
  const goalWords = goal.trim().split(/\s+/).length
  if (activeDod.length >= 6 || goalWords >= 50) return 'large'
  if (activeDod.length >= 3 || goalWords >= 20) return 'medium'
  return 'small'
}

/**
 * M110: Recommend a budget based on task complexity.
 * Small:  $1  → ~35 turns
 * Medium: $2  → ~60 turns
 * Large:  $5  → ~120 turns
 */
export function budgetForComplexity(dodItems: string[], goal: string): number {
  const tier = getComplexityTier(dodItems, goal)
  if (tier === 'large') return 5.0
  if (tier === 'medium') return 2.0
  return 1.0
}

export const COMPLEXITY_LABELS: Record<ComplexityTier, { label: string; turns: string; color: string }> = {
  small:  { label: 'Klein',  turns: '~35 Turns',   color: 'text-green-400' },
  medium: { label: 'Mittel', turns: '~60 Turns',   color: 'text-yellow-400' },
  large:  { label: 'Groß',   turns: '~120 Turns',  color: 'text-orange-400' },
}
