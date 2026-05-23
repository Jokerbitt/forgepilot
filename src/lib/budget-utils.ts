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
