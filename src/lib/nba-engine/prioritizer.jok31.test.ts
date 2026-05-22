import { describe, it, expect } from 'vitest'
import { prioritizeJokItems } from './prioritizer'
import type { WorkItem, ScoringContext } from './types'

const fixedContext: ScoringContext = { currentDate: '2026-05-21T12:00:00.000Z' }

const makeItem = (overrides: Partial<WorkItem> & Pick<WorkItem, 'id'>): WorkItem => ({
  title: `Item ${overrides.id}`,
  priority: 3,
  status: 'todo',
  ...overrides,
})

describe('prioritizeJokItems', () => {
  it('returns empty array for empty input', () => {
    expect(prioritizeJokItems([], fixedContext)).toEqual([])
  })

  it('returns scored items sorted by score descending', () => {
    const items: WorkItem[] = [
      makeItem({ id: 'low', priority: 4, status: 'todo' }),
      makeItem({ id: 'urgent', priority: 1, status: 'todo' }),
      makeItem({ id: 'medium', priority: 3, status: 'todo' }),
    ]
    const result = prioritizeJokItems(items, fixedContext)
    expect(result[0].item.id).toBe('urgent')
    expect(result[1].item.id).toBe('medium')
    expect(result[2].item.id).toBe('low')
    expect(result[0].score).toBeGreaterThanOrEqual(result[1].score)
    expect(result[1].score).toBeGreaterThanOrEqual(result[2].score)
  })

  it('each ScoredItem contains item, score (0-100), and reasoning (max 3)', () => {
    const items: WorkItem[] = [makeItem({ id: 'a', priority: 2, status: 'in_progress' })]
    const result = prioritizeJokItems(items, fixedContext)
    expect(result).toHaveLength(1)
    const [first] = result
    expect(first.item).toBeDefined()
    expect(typeof first.score).toBe('number')
    expect(first.score).toBeGreaterThanOrEqual(0)
    expect(first.score).toBeLessThanOrEqual(100)
    expect(Array.isArray(first.reasoning)).toBe(true)
    expect(first.reasoning.length).toBeLessThanOrEqual(3)
    expect(first.reasoning.length).toBeGreaterThanOrEqual(1)
  })

  it('urgent + in_progress item appears at top with score >= 75 (with overdue)', () => {
    const items: WorkItem[] = [
      makeItem({
        id: 'top',
        priority: 1,
        status: 'in_progress',
        dueDate: '2026-05-01T00:00:00.000Z', // overdue
      }),
      makeItem({ id: 'bottom', priority: 4, status: 'backlog' }),
    ]
    const result = prioritizeJokItems(items, fixedContext)
    expect(result[0].item.id).toBe('top')
    expect(result[0].score).toBeGreaterThanOrEqual(75)
  })

  it('includes priority in reasoning', () => {
    const items: WorkItem[] = [makeItem({ id: 'x', priority: 1, status: 'todo' })]
    const [result] = prioritizeJokItems(items, fixedContext)
    expect(result.reasoning.some((r) => r.toLowerCase().includes('urgent'))).toBe(true)
  })

  it('mentions in_progress in reasoning', () => {
    const items: WorkItem[] = [makeItem({ id: 'y', priority: 2, status: 'in_progress' })]
    const [result] = prioritizeJokItems(items, fixedContext)
    expect(result.reasoning.some((r) => r.toLowerCase().includes('in progress'))).toBe(true)
  })

  it('mentions overdue in reasoning', () => {
    const items: WorkItem[] = [
      makeItem({ id: 'z', priority: 2, dueDate: '2026-04-01T00:00:00.000Z' }),
    ]
    const [result] = prioritizeJokItems(items, fixedContext)
    expect(result.reasoning.some((r) => r.toLowerCase().includes('overdue'))).toBe(true)
  })

  it('single item returns array of length 1', () => {
    const items: WorkItem[] = [makeItem({ id: 'solo', priority: 2 })]
    expect(prioritizeJokItems(items, fixedContext)).toHaveLength(1)
  })

  it('works without context argument', () => {
    const items: WorkItem[] = [makeItem({ id: 'nc', priority: 2 })]
    const result = prioritizeJokItems(items)
    expect(result).toHaveLength(1)
    expect(result[0].score).toBeGreaterThanOrEqual(0)
  })

  it('preserves all items in result (no filtering)', () => {
    const items: WorkItem[] = [
      makeItem({ id: 'done-item', priority: 3, status: 'done' }),
      makeItem({ id: 'cancelled-item', priority: 3, status: 'cancelled' }),
      makeItem({ id: 'active-item', priority: 3, status: 'todo' }),
    ]
    const result = prioritizeJokItems(items, fixedContext)
    expect(result).toHaveLength(3)
  })
})
