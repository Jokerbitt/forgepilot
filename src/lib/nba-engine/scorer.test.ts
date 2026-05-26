import { describe, it, expect, vi } from 'vitest'
import { scoreWorkItem } from './scorer'
import type { WorkItem } from './types'

vi.mock('./nba-config', () => ({
  getNBAConfig: vi.fn(() => ({ approvalMode: 'balanced', autopilotMinScore: 70, autopilotMaxRiskClass: 'A' })),
}))

function makeItem(overrides: Partial<WorkItem> = {}): WorkItem {
  return {
    id: 'wi-1',
    title: 'Test item',
    priority: 3,
    status: 'todo',
    ...overrides,
  }
}

const NOW = '2026-05-26T10:00:00.000Z'

describe('scoreWorkItem', () => {
  it('returns 0 for lowest-priority backlog item', () => {
    const item = makeItem({ priority: 4, status: 'backlog' })
    // priority=4 → 10pts, backlog → -10pts = 0
    expect(scoreWorkItem(item, { currentDate: NOW })).toBe(0)
  })

  it('returns max priority points for urgent items', () => {
    const item = makeItem({ priority: 1, status: 'todo' })
    // urgent=50pts
    expect(scoreWorkItem(item, { currentDate: NOW })).toBeGreaterThanOrEqual(50)
  })

  it('adds 15 bonus for in_progress status', () => {
    const base = scoreWorkItem(makeItem({ priority: 3, status: 'todo' }), { currentDate: NOW })
    const inProgress = scoreWorkItem(makeItem({ priority: 3, status: 'in_progress' }), { currentDate: NOW })
    expect(inProgress - base).toBe(15)
  })

  it('also handles in-progress (hyphen variant)', () => {
    const item = makeItem({ priority: 3, status: 'in-progress' })
    const base = scoreWorkItem(makeItem({ priority: 3, status: 'todo' }), { currentDate: NOW })
    expect(scoreWorkItem(item, { currentDate: NOW }) - base).toBe(15)
  })

  it('adds 25 for overdue items', () => {
    const pastDate = '2026-05-20T10:00:00.000Z'
    const item = makeItem({ priority: 3, dueDate: pastDate })
    const base = scoreWorkItem(makeItem({ priority: 3 }), { currentDate: NOW })
    expect(scoreWorkItem(item, { currentDate: NOW }) - base).toBe(25)
  })

  it('adds 20 for items due within 3 days', () => {
    const soonDate = '2026-05-27T10:00:00.000Z' // tomorrow
    const item = makeItem({ priority: 3, dueDate: soonDate })
    const base = scoreWorkItem(makeItem({ priority: 3 }), { currentDate: NOW })
    expect(scoreWorkItem(item, { currentDate: NOW }) - base).toBe(20)
  })

  it('adds 10 for items due within 7 days', () => {
    const soonDate = '2026-05-30T10:00:00.000Z' // 4 days away
    const item = makeItem({ priority: 3, dueDate: soonDate })
    const base = scoreWorkItem(makeItem({ priority: 3 }), { currentDate: NOW })
    expect(scoreWorkItem(item, { currentDate: NOW }) - base).toBe(10)
  })

  it('adds 15 for critical riskClass', () => {
    const item = makeItem({ priority: 3, riskClass: 'critical' })
    const base = scoreWorkItem(makeItem({ priority: 3 }), { currentDate: NOW })
    expect(scoreWorkItem(item, { currentDate: NOW }) - base).toBe(15)
  })

  it('adds 5 for items updated in the last 24h', () => {
    const recentlyUpdated = '2026-05-26T08:00:00.000Z'
    const item = makeItem({ priority: 3, lastUpdated: recentlyUpdated })
    const base = scoreWorkItem(makeItem({ priority: 3 }), { currentDate: NOW })
    expect(scoreWorkItem(item, { currentDate: NOW }) - base).toBe(5)
  })

  it('does not add recency bonus for items updated >24h ago', () => {
    const oldUpdate = '2026-05-24T08:00:00.000Z'
    const item = makeItem({ priority: 3, lastUpdated: oldUpdate })
    const base = scoreWorkItem(makeItem({ priority: 3 }), { currentDate: NOW })
    expect(scoreWorkItem(item, { currentDate: NOW })).toBe(base)
  })

  it('caps score at 100', () => {
    const item = makeItem({
      priority: 1,  // 50pts
      status: 'in_progress',  // +15
      dueDate: '2026-05-20T00:00:00.000Z',  // overdue +25
      riskClass: 'critical',  // +15
      lastUpdated: '2026-05-26T09:00:00.000Z',  // +5 = 110pts total → capped at 100
    })
    expect(scoreWorkItem(item, { currentDate: NOW })).toBe(100)
  })

  it('returns 0 minimum even with negative contributions', () => {
    const item = makeItem({ priority: 0, status: 'backlog' })
    // 0 - 10 = -10, but floor at 0
    expect(scoreWorkItem(item, { currentDate: NOW })).toBe(0)
  })
})
