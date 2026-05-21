import { describe, it, expect } from 'vitest'
import { calcAvgScore } from './CriticScorePill'

describe('calcAvgScore', () => {
  it('computes average as (correctness + efficiency + (100 - drift)) / 3', () => {
    // (90 + 80 + (100 - 10)) / 3 = (90 + 80 + 90) / 3 = 260 / 3 ≈ 87
    expect(calcAvgScore(90, 80, 10)).toBe(87)
  })

  it('returns 0 for worst-case scores', () => {
    // (0 + 0 + (100 - 100)) / 3 = 0
    expect(calcAvgScore(0, 0, 100)).toBe(0)
  })

  it('returns 100 for perfect scores', () => {
    // (100 + 100 + (100 - 0)) / 3 = 300 / 3 = 100
    expect(calcAvgScore(100, 100, 0)).toBe(100)
  })

  it('rounds to nearest integer', () => {
    // (70 + 70 + (100 - 70)) / 3 = (70 + 70 + 30) / 3 = 170 / 3 ≈ 56.67 → 57
    expect(calcAvgScore(70, 70, 70)).toBe(57)
  })

  it('handles a typical mid-range score set', () => {
    // (75 + 60 + (100 - 40)) / 3 = (75 + 60 + 60) / 3 = 195 / 3 = 65
    expect(calcAvgScore(75, 60, 40)).toBe(65)
  })
})
