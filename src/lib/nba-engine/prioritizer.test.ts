import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prioritizeJokItems } from './prioritizer'
import type { WorkItem } from './types'

vi.mock('./nba-config', () => ({
  getNBAConfig: vi.fn(() => ({
    approvalMode: 'balanced',
    autopilotMinScore: 70,
    autopilotMaxRiskClass: 'A',
    ignoreStatuses: ['done', 'cancelled'],
    maxRecommendations: 10,
    showTriageJoker: false,
    backlogPenaltyAgeDays: 30,
  })),
}))

vi.mock('./scorer', async () => {
  const actual = await vi.importActual<typeof import('./scorer')>('./scorer')
  return actual
})

const NOW = '2026-05-26T10:00:00.000Z'

function makeItem(overrides: Partial<WorkItem> = {}): WorkItem {
  return {
    id: 'wi-1',
    title: 'Test item',
    priority: 3,
    status: 'todo',
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('prioritizeJokItems', () => {
  it('returns empty array for empty input', () => {
    expect(prioritizeJokItems([])).toEqual([])
  })

  it('returns items sorted by score descending', () => {
    const items: WorkItem[] = [
      makeItem({ id: 'low', priority: 4, status: 'todo' }),   // low priority
      makeItem({ id: 'urgent', priority: 1, status: 'todo' }), // urgent
      makeItem({ id: 'med', priority: 3, status: 'todo' }),    // medium
    ]

    const result = prioritizeJokItems(items, { currentDate: NOW })

    expect(result[0].item.id).toBe('urgent')
    expect(result[result.length - 1].item.id).toBe('low')
  })

  it('includes score and reasoning for each item', () => {
    const item = makeItem({ priority: 2, status: 'in_progress' })
    const result = prioritizeJokItems([item], { currentDate: NOW })

    expect(result).toHaveLength(1)
    expect(typeof result[0].score).toBe('number')
    expect(Array.isArray(result[0].reasoning)).toBe(true)
    expect(result[0].reasoning.length).toBeGreaterThan(0)
  })

  it('includes priority label in reasoning', () => {
    const item = makeItem({ priority: 1, status: 'todo' })
    const result = prioritizeJokItems([item], { currentDate: NOW })

    expect(result[0].reasoning.some(r => r.toLowerCase().includes('urgent'))).toBe(true)
  })

  it('includes in-progress bonus in reasoning', () => {
    const item = makeItem({ priority: 2, status: 'in_progress' })
    const result = prioritizeJokItems([item], { currentDate: NOW })

    expect(result[0].reasoning.some(r => r.includes('in progress'))).toBe(true)
  })

  it('includes overdue note in reasoning', () => {
    const item = makeItem({ priority: 3, dueDate: '2026-05-20T00:00:00.000Z' })
    const result = prioritizeJokItems([item], { currentDate: NOW })

    expect(result[0].reasoning.some(r => r.toLowerCase().includes('overdue'))).toBe(true)
  })

  it('caps reasoning at 3 items', () => {
    const item = makeItem({
      priority: 1,
      status: 'in_progress',
      dueDate: '2026-05-20T00:00:00.000Z',
      riskClass: 'critical',
      lastUpdated: '2026-05-26T09:00:00.000Z',
    })
    const result = prioritizeJokItems([item], { currentDate: NOW })

    expect(result[0].reasoning.length).toBeLessThanOrEqual(3)
  })
})
