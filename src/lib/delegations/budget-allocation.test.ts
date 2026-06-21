import { describe, it, expect } from 'vitest'
import { allocateBudget } from './budget-allocation'

describe('allocateBudget', () => {
  it('splits evenly when all phases weigh the same', () => {
    const a = allocateBudget(9, [{ estimatedTurns: 50 }, { estimatedTurns: 50 }, { estimatedTurns: 50 }])
    expect(a.perPhaseUsd).toEqual([3, 3, 3])
    expect(a.totalUsd).toBe(9)
  })

  it('weights by estimated effort and sums back to the budget', () => {
    const a = allocateBudget(10, [{ estimatedTurns: 10 }, { estimatedTurns: 30 }, { estimatedTurns: 60 }])
    expect(a.perPhaseUsd).toEqual([1, 3, 6])
    expect(a.totalUsd).toBe(10)
  })

  it('absorbs rounding drift so the total matches the budget', () => {
    const a = allocateBudget(10, [{ estimatedTurns: 1 }, { estimatedTurns: 1 }, { estimatedTurns: 1 }])
    expect(a.totalUsd).toBe(10)
  })

  it('applies a per-phase floor for tiny phases', () => {
    const a = allocateBudget(100, [{ estimatedTurns: 1 }, { estimatedTurns: 999 }], 0.5)
    expect(a.perPhaseUsd[0]).toBeGreaterThanOrEqual(0.5)
    expect(a.perPhaseUsd[1]).toBeGreaterThan(a.perPhaseUsd[0])
  })

  it('returns zeros for a zero/negative budget and [] for no phases', () => {
    expect(allocateBudget(0, [{ estimatedTurns: 10 }]).perPhaseUsd).toEqual([0])
    expect(allocateBudget(-5, [{ estimatedTurns: 10 }]).totalUsd).toBe(0)
    expect(allocateBudget(10, []).perPhaseUsd).toEqual([])
  })
})
