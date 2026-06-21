import { describe, it, expect } from 'vitest'
import { aggregateDelegationCosts, reviewCost } from './cost-review'

describe('aggregateDelegationCosts', () => {
  it('sums estimate, actual and budget across delegations', () => {
    const agg = aggregateDelegationCosts([
      { costEstimateUsd: 0.2, actualCostUsd: 0.15, maxBudgetUsd: 1 },
      { costEstimateUsd: 0.3, actualCostUsd: 0.35, maxBudgetUsd: 2 },
    ])
    expect(agg).toEqual({ estimatedCostUsd: 0.5, actualCostUsd: 0.5, maxBudgetUsd: 3 })
  })

  it('ignores missing, zero and negative values', () => {
    const agg = aggregateDelegationCosts([
      { costEstimateUsd: -1, actualCostUsd: undefined, maxBudgetUsd: 0 },
      {},
      { actualCostUsd: 0.1 },
    ])
    expect(agg).toEqual({ estimatedCostUsd: 0, actualCostUsd: 0.1, maxBudgetUsd: 0 })
  })

  it('returns all zeros for an empty list', () => {
    expect(aggregateDelegationCosts([])).toEqual({ estimatedCostUsd: 0, actualCostUsd: 0, maxBudgetUsd: 0 })
  })
})

describe('reviewCost — verdict', () => {
  it('free when nothing was actually spent', () => {
    const r = reviewCost({ estimatedCostUsd: 0.5, actualCostUsd: 0 })
    expect(r.verdict).toBe('free')
    expect(r.headline).toMatch(/nichts gekostet/)
    expect(r.actualCostEur).toBe(0)
  })

  it('cheaper when clearly under the estimate', () => {
    const r = reviewCost({ estimatedCostUsd: 1, actualCostUsd: 0.5, appName: 'PlantVault' })
    expect(r.verdict).toBe('cheaper')
    expect(r.deltaPercent).toBe(-50)
    expect(r.headline).toMatch(/PlantVault war günstiger/)
    expect(r.headline).toContain('0,46 €')
    expect(r.headline).toContain('0,92 €')
  })

  it('as-expected within the tolerance band', () => {
    const r = reviewCost({ estimatedCostUsd: 1, actualCostUsd: 1.05 })
    expect(r.verdict).toBe('as-expected')
    expect(r.deltaPercent).toBe(5)
    expect(r.headline).toMatch(/im Kostenrahmen/)
  })

  it('pricier when clearly over the estimate', () => {
    const r = reviewCost({ estimatedCostUsd: 0.2, actualCostUsd: 0.5 })
    expect(r.verdict).toBe('pricier')
    expect(r.deltaPercent).toBe(150)
    expect(r.headline).toMatch(/teurer als gedacht/)
    expect(r.headline).toContain('+150 %')
  })

  it('pricier with a dedicated line when it was estimated as free', () => {
    const r = reviewCost({ estimatedCostUsd: 0, actualCostUsd: 0.5 })
    expect(r.verdict).toBe('pricier')
    expect(r.deltaPercent).toBeNull()
    expect(r.headline).toMatch(/vorab als kostenlos eingeschätzt/)
  })

  it('treats exactly -10% as cheaper and +10% as pricier (band edges)', () => {
    expect(reviewCost({ estimatedCostUsd: 1, actualCostUsd: 0.9 }).verdict).toBe('cheaper')
    expect(reviewCost({ estimatedCostUsd: 1, actualCostUsd: 1.1 }).verdict).toBe('pricier')
  })
})

describe('reviewCost — budget', () => {
  it('flags an exceeded budget', () => {
    const r = reviewCost({ estimatedCostUsd: 0.3, actualCostUsd: 0.5, maxBudgetUsd: 0.4 })
    expect(r.budgetExceeded).toBe(true)
    expect(r.budgetWarning).toBe(false)
    expect(r.budgetText).toMatch(/Budget überschritten/)
    expect(r.details).toContain(r.budgetText)
  })

  it('warns at >= 80% usage', () => {
    const r = reviewCost({ estimatedCostUsd: 0.8, actualCostUsd: 0.85, maxBudgetUsd: 1 })
    expect(r.budgetWarning).toBe(true)
    expect(r.budgetExceeded).toBe(false)
    expect(r.budgetText).toMatch(/zu 85 % genutzt/)
  })

  it('confirms staying within budget', () => {
    const r = reviewCost({ estimatedCostUsd: 0.3, actualCostUsd: 0.3, maxBudgetUsd: 1 })
    expect(r.budgetExceeded).toBe(false)
    expect(r.budgetWarning).toBe(false)
    expect(r.budgetText).toMatch(/Im Budget/)
  })

  it('omits the budget line when no budget is set', () => {
    const r = reviewCost({ estimatedCostUsd: 0.3, actualCostUsd: 0.3 })
    expect(r.budgetText).toBeNull()
    expect(r.budgetExceeded).toBe(false)
    expect(r.details).toHaveLength(2)
  })
})
