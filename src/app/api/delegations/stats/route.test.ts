import { describe, it, expect } from 'vitest'
import type { DelegationStats } from './route'

describe('DelegationStats shape', () => {
  it('has expected numeric fields', () => {
    const stats: DelegationStats = {
      total: 10,
      byStatus: { pending: 3, running: 1, completed: 6 },
      running: 1,
      pending: 3,
      approved: 0,
      completed: 6,
      failed: 0,
      cancelled: 0,
      totalEstimatedUsd: 5.50,
      totalActualUsd: 2.34,
      todayCount: 4,
      todayActualUsd: 1.10,
      prCreated: 3,
      prMerged: 2,
      prOpen: 1,
    }

    expect(stats.total).toBe(10)
    expect(stats.running + stats.pending + stats.completed).toBe(stats.total)
    expect(stats.totalEstimatedUsd).toBeGreaterThan(0)
    expect(stats.todayCount).toBeLessThanOrEqual(stats.total)
  })

  it('byStatus sum matches total', () => {
    const stats: DelegationStats = {
      total: 4,
      byStatus: { pending: 2, running: 1, failed: 1 },
      running: 1, pending: 2, approved: 0, completed: 0, failed: 1, cancelled: 0,
      totalEstimatedUsd: 0, totalActualUsd: 0, todayCount: 0, todayActualUsd: 0,
      prCreated: 0, prMerged: 0, prOpen: 0,
    }
    const sum = Object.values(stats.byStatus).reduce((a, b) => a + b, 0)
    expect(sum).toBe(stats.total)
  })
})
