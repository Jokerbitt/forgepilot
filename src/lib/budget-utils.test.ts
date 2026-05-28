import { describe, it, expect } from 'vitest'
import { budgetToMaxTurns, budgetToClaudeCliMaxTurns, estimateComplexity, budgetToClaudeCliMaxTurnsByComplexity } from './budget-utils'

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

describe('estimateComplexity', () => {
  it('returns small for 1-2 DoD items and short goal', () => {
    const result = estimateComplexity(['Add button'], 'Add a submit button', undefined)
    expect(result.complexity).toBe('small')
    expect(result.recommendedBudgetUsd).toBe(1)
    expect(result.recommendedTurns).toBe(35)
  })

  it('returns medium for 3-5 DoD items', () => {
    const result = estimateComplexity(
      ['Item 1', 'Item 2', 'Item 3'],
      'Build a small feature',
      undefined,
    )
    expect(result.complexity).toBe('medium')
    expect(result.recommendedBudgetUsd).toBe(3)
  })

  it('returns large for 6+ DoD items', () => {
    const items = ['A', 'B', 'C', 'D', 'E', 'F']
    const result = estimateComplexity(items, 'Build feature', undefined)
    expect(result.complexity).toBe('large')
    expect(result.recommendedTurns).toBe(140)
  })

  it('returns large for long goal text (>120 chars)', () => {
    const longGoal = 'Build a comprehensive authentication system with OAuth, session management, role-based access control, MFA, and full audit logging'
    const result = estimateComplexity([], longGoal, undefined)
    expect(result.complexity).toBe('large')
  })

  it('returns large for large-feature taskType regardless of DoD count', () => {
    const result = estimateComplexity(['single item'], 'Short goal', 'large-feature')
    expect(result.complexity).toBe('large')
  })

  it('ignores blank DoD items when counting', () => {
    const result = estimateComplexity(['', '  ', 'real item'], 'Short goal', undefined)
    expect(result.complexity).toBe('small')
  })

  it('returns a non-empty label and reason', () => {
    const result = estimateComplexity(['A', 'B', 'C', 'D'], 'Some goal', undefined)
    expect(result.label.length).toBeGreaterThan(0)
    expect(result.reason.length).toBeGreaterThan(0)
  })
})

describe('budgetToClaudeCliMaxTurnsByComplexity', () => {
  it('returns at least base turns for the complexity band', () => {
    expect(budgetToClaudeCliMaxTurnsByComplexity(1, 'small')).toBeGreaterThanOrEqual(35)
    expect(budgetToClaudeCliMaxTurnsByComplexity(3, 'medium')).toBeGreaterThanOrEqual(70)
    expect(budgetToClaudeCliMaxTurnsByComplexity(8, 'large')).toBeGreaterThanOrEqual(140)
  })

  it('large complexity can exceed the old 60-turn cap', () => {
    expect(budgetToClaudeCliMaxTurnsByComplexity(8, 'large')).toBeGreaterThan(60)
  })

  it('caps large at 200 turns', () => {
    expect(budgetToClaudeCliMaxTurnsByComplexity(1000, 'large')).toBeLessThanOrEqual(200)
  })

  it('caps medium at 100 turns', () => {
    expect(budgetToClaudeCliMaxTurnsByComplexity(1000, 'medium')).toBeLessThanOrEqual(100)
  })
})
