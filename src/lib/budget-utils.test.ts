import { describe, it, expect } from 'vitest'
import { budgetToMaxTurns, budgetToClaudeCliMaxTurns } from './budget-utils'

describe('budgetToMaxTurns', () => {
  it('returns minimum of 5 turns for very small budgets', () => {
    expect(budgetToMaxTurns(0)).toBe(5)
    expect(budgetToMaxTurns(0.1)).toBe(5)
  })

  it('scales linearly: $1 → 15 turns', () => {
    expect(budgetToMaxTurns(1)).toBe(15)
  })

  it('scales linearly: $2 → 30 turns', () => {
    expect(budgetToMaxTurns(2)).toBe(30)
  })

  it('caps at 60 turns for large budgets', () => {
    expect(budgetToMaxTurns(5)).toBe(60)
    expect(budgetToMaxTurns(10)).toBe(60)
    expect(budgetToMaxTurns(100)).toBe(60)
  })

  it('returns exactly 60 at the cap boundary (~$4)', () => {
    expect(budgetToMaxTurns(4)).toBe(60)
  })
})

describe('budgetToClaudeCliMaxTurns', () => {
  it('returns at least 35 turns for small budgets', () => {
    expect(budgetToClaudeCliMaxTurns(0)).toBe(35)
    expect(budgetToClaudeCliMaxTurns(0.5)).toBe(35)
    expect(budgetToClaudeCliMaxTurns(1)).toBe(35)
  })

  it('returns higher value when budget is large enough', () => {
    expect(budgetToClaudeCliMaxTurns(3)).toBe(45)
  })

  it('caps at 60 for large budgets (same as budgetToMaxTurns)', () => {
    expect(budgetToClaudeCliMaxTurns(5)).toBe(60)
    expect(budgetToClaudeCliMaxTurns(100)).toBe(60)
  })

  it('is always >= budgetToMaxTurns', () => {
    for (const budget of [0, 0.5, 1, 2, 3, 4, 5]) {
      expect(budgetToClaudeCliMaxTurns(budget)).toBeGreaterThanOrEqual(budgetToMaxTurns(budget))
    }
  })
})
