import { describe, it, expect } from 'vitest'
import { computeCostRatio, costBarColor } from './CostMeter'

describe('computeCostRatio', () => {
  it('uses actualCostUsd when provided', () => {
    expect(computeCostRatio(0.5, 1.0, 2.0)).toBeCloseTo(0.25)
  })

  it('falls back to estimateCostUsd when actual is undefined', () => {
    expect(computeCostRatio(undefined, 1.0, 2.0)).toBeCloseTo(0.5)
  })

  it('clamps ratio at 1 when over budget', () => {
    expect(computeCostRatio(5.0, 1.0, 2.0)).toBe(1)
  })

  it('returns 0 when max budget is 0', () => {
    expect(computeCostRatio(1.0, 1.0, 0)).toBe(0)
  })

  it('returns 0 when both actual and estimate are 0', () => {
    expect(computeCostRatio(0, 0, 2.0)).toBe(0)
  })
})

describe('costBarColor', () => {
  it('green below 60%', () => {
    expect(costBarColor(0.3)).toBe('bg-emerald-500')
  })

  it('yellow at 60%', () => {
    expect(costBarColor(0.6)).toBe('bg-yellow-500')
  })

  it('yellow between 60% and 90%', () => {
    expect(costBarColor(0.75)).toBe('bg-yellow-500')
  })

  it('red at 90%', () => {
    expect(costBarColor(0.9)).toBe('bg-red-500')
  })

  it('red above 90%', () => {
    expect(costBarColor(1.0)).toBe('bg-red-500')
  })
})
