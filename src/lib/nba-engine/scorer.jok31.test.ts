import { describe, it, expect } from 'vitest'
import { scoreWorkItem } from './scorer'
import type { WorkItem, ScoringContext } from './types'

const baseItem: WorkItem = {
  id: 'JOK-31-1',
  title: 'Test item',
  priority: 3, // Medium
  status: 'todo',
}

const fixedContext: ScoringContext = { currentDate: '2026-05-21T12:00:00.000Z' }

describe('scoreWorkItem', () => {
  it('returns 0 for item with no priority, no status bonus, no dueDate', () => {
    const score = scoreWorkItem({ ...baseItem, priority: 0 }, fixedContext)
    expect(score).toBe(0)
  })

  it('applies correct priority points: Urgent=50, High=35, Medium=20, Low=10, None=0', () => {
    expect(scoreWorkItem({ ...baseItem, priority: 1 }, fixedContext)).toBe(50) // urgent
    expect(scoreWorkItem({ ...baseItem, priority: 2 }, fixedContext)).toBe(35) // high
    expect(scoreWorkItem({ ...baseItem, priority: 3 }, fixedContext)).toBe(20) // medium
    expect(scoreWorkItem({ ...baseItem, priority: 4 }, fixedContext)).toBe(10) // low
    expect(scoreWorkItem({ ...baseItem, priority: 0 }, fixedContext)).toBe(0)  // none
  })

  it('gives +15 bonus for in_progress status', () => {
    const score = scoreWorkItem({ ...baseItem, priority: 3, status: 'in_progress' }, fixedContext)
    expect(score).toBe(35) // 20 (medium) + 15 (in_progress)
  })

  it('gives +15 bonus for in-progress status (hyphen variant)', () => {
    const score = scoreWorkItem({ ...baseItem, priority: 3, status: 'in-progress' }, fixedContext)
    expect(score).toBe(35)
  })

  it('gives -10 penalty for backlog status', () => {
    const score = scoreWorkItem({ ...baseItem, priority: 3, status: 'backlog' }, fixedContext)
    expect(score).toBe(10) // 20 - 10
  })

  it('adds +25 for overdue items', () => {
    const score = scoreWorkItem(
      { ...baseItem, priority: 2, dueDate: '2026-05-01T00:00:00.000Z' },
      fixedContext,
    )
    expect(score).toBe(60) // 35 (high) + 25 (overdue)
  })

  it('adds +20 for due in < 3 days', () => {
    const score = scoreWorkItem(
      { ...baseItem, priority: 2, dueDate: '2026-05-22T00:00:00.000Z' },
      fixedContext,
    )
    expect(score).toBe(55) // 35 + 20
  })

  it('adds +10 for due in < 7 days', () => {
    const score = scoreWorkItem(
      { ...baseItem, priority: 2, dueDate: '2026-05-26T00:00:00.000Z' },
      fixedContext,
    )
    expect(score).toBe(45) // 35 + 10
  })

  it('adds no dueDate bonus for items due far in future', () => {
    const score = scoreWorkItem(
      { ...baseItem, priority: 2, dueDate: '2026-06-30T00:00:00.000Z' },
      fixedContext,
    )
    expect(score).toBe(35)
  })

  it('applies riskClass bonus: critical=+15, high=+8, medium=+3, low=0', () => {
    expect(scoreWorkItem({ ...baseItem, priority: 3, riskClass: 'critical' }, fixedContext)).toBe(35) // 20 + 15
    expect(scoreWorkItem({ ...baseItem, priority: 3, riskClass: 'high' }, fixedContext)).toBe(28) // 20 + 8
    expect(scoreWorkItem({ ...baseItem, priority: 3, riskClass: 'medium' }, fixedContext)).toBe(23) // 20 + 3
    expect(scoreWorkItem({ ...baseItem, priority: 3, riskClass: 'low' }, fixedContext)).toBe(20)
  })

  it('adds +5 recency bonus for items updated in last 24h', () => {
    const recentDate = new Date('2026-05-21T10:00:00.000Z').toISOString()
    const score = scoreWorkItem(
      { ...baseItem, priority: 3, lastUpdated: recentDate },
      fixedContext,
    )
    expect(score).toBe(25) // 20 + 5
  })

  it('does not add recency bonus for items updated > 24h ago', () => {
    const oldDate = new Date('2026-05-19T10:00:00.000Z').toISOString()
    const score = scoreWorkItem(
      { ...baseItem, priority: 3, lastUpdated: oldDate },
      fixedContext,
    )
    expect(score).toBe(20)
  })

  it('urgent in_progress item scores >= 65', () => {
    const score = scoreWorkItem(
      { ...baseItem, priority: 1, status: 'in_progress' },
      fixedContext,
    )
    expect(score).toBeGreaterThanOrEqual(65) // 50 + 15 = 65
  })

  it('urgent in_progress overdue item scores >= 75', () => {
    const score = scoreWorkItem(
      {
        ...baseItem,
        priority: 1,
        status: 'in_progress',
        dueDate: '2026-05-01T00:00:00.000Z', // overdue
      },
      fixedContext,
    )
    expect(score).toBeGreaterThanOrEqual(75) // 50 + 15 + 25 = 90
  })

  it('urgent in_progress item with high risk class scores >= 73', () => {
    const score = scoreWorkItem(
      {
        ...baseItem,
        priority: 1,
        status: 'in_progress',
        riskClass: 'high',
      },
      fixedContext,
    )
    expect(score).toBeGreaterThanOrEqual(73) // 50 + 15 + 8 = 73
  })

  it('urgent in_progress item with critical risk class scores >= 75', () => {
    const score = scoreWorkItem(
      {
        ...baseItem,
        priority: 1,
        status: 'in_progress',
        riskClass: 'critical',
      },
      fixedContext,
    )
    expect(score).toBeGreaterThanOrEqual(75) // 50 + 15 + 15 = 80
  })

  it('done status item scores lower than in_progress item of same priority', () => {
    const doneScore = scoreWorkItem({ ...baseItem, priority: 2, status: 'done' }, fixedContext)
    const inProgressScore = scoreWorkItem({ ...baseItem, priority: 2, status: 'in_progress' }, fixedContext)
    expect(doneScore).toBeLessThan(inProgressScore)
  })

  it('cancelled status item scores lower than in_progress item', () => {
    const cancelledScore = scoreWorkItem({ ...baseItem, priority: 2, status: 'cancelled' }, fixedContext)
    const inProgressScore = scoreWorkItem({ ...baseItem, priority: 2, status: 'in_progress' }, fixedContext)
    expect(cancelledScore).toBeLessThan(inProgressScore)
  })

  it('caps score at 100', () => {
    const score = scoreWorkItem(
      {
        ...baseItem,
        priority: 1,
        status: 'in_progress',
        riskClass: 'critical',
        dueDate: '2026-05-01T00:00:00.000Z',
        lastUpdated: new Date('2026-05-21T11:00:00.000Z').toISOString(),
      },
      fixedContext,
    )
    expect(score).toBeLessThanOrEqual(100)
  })

  it('floors score at 0', () => {
    const score = scoreWorkItem({ ...baseItem, priority: 0, status: 'backlog' }, fixedContext)
    expect(score).toBe(0) // 0 - 10 = clamped to 0
  })

  it('works without context (uses current date)', () => {
    const score = scoreWorkItem({ ...baseItem, priority: 2 })
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(100)
  })
})
