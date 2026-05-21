import { describe, it, expect } from 'vitest'
import { calcAvgScore } from './CriticScorePill'

describe('calcAvgScore', () => {
  it('calculates average from perfect scores', () => {
    expect(calcAvgScore(100, 100, 0)).toBe(100)
  })

  it('calculates average from zero scores', () => {
    expect(calcAvgScore(0, 0, 100)).toBe(0)
  })

  it('calculates correctly for typical approved result', () => {
    // (90 + 85 + (100-10)) / 3 = (90+85+90)/3 = 265/3 = 88.33 → 88
    expect(calcAvgScore(90, 85, 10)).toBe(88)
  })

  it('calculates correctly for needs-revision result', () => {
    // (60 + 55 + (100-30)) / 3 = (60+55+70)/3 = 185/3 = 61.67 → 62
    expect(calcAvgScore(60, 55, 30)).toBe(62)
  })

  it('rounds to nearest integer', () => {
    // (50 + 50 + (100-50)) / 3 = 150/3 = 50
    expect(calcAvgScore(50, 50, 50)).toBe(50)
  })
})
