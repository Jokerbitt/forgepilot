/**
 * Inline sort logic extracted from work-items page for unit testing.
 * Mirrors the sort implementation in WorkItemsTab.
 */
import { describe, it, expect } from 'vitest'
import type { WorkItem } from '@/lib/models/work-item'

type SortKey = 'priority' | 'title' | 'updatedAt'

function sortItems(items: WorkItem[], sortKey: SortKey, sortDir: 'asc' | 'desc'): WorkItem[] {
  return [...items].sort((a, b) => {
    let cmp = 0
    if (sortKey === 'priority') cmp = a.priority - b.priority
    else if (sortKey === 'title') cmp = a.title.localeCompare(b.title)
    else if (sortKey === 'updatedAt') cmp = a.updatedAt.localeCompare(b.updatedAt)
    return sortDir === 'asc' ? cmp : -cmp
  })
}

function makeItem(overrides: Partial<WorkItem> & { id: string }): WorkItem {
  return {
    source: 'local',
    type: 'ticket',
    title: 'Test item',
    url: '',
    projectId: 'proj',
    status: 'todo',
    priority: 2,
    blocked: false,
    risk: 'A',
    aiDelegable: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('sortItems by priority', () => {
  it('sorts ascending (urgent first)', () => {
    const items = [
      makeItem({ id: '1', priority: 3 }),
      makeItem({ id: '2', priority: 0 }),
      makeItem({ id: '3', priority: 2 }),
    ]
    const result = sortItems(items, 'priority', 'asc')
    expect(result.map(i => i.id)).toEqual(['2', '3', '1'])
  })

  it('sorts descending (low priority first)', () => {
    const items = [
      makeItem({ id: '1', priority: 0 }),
      makeItem({ id: '2', priority: 3 }),
      makeItem({ id: '3', priority: 1 }),
    ]
    const result = sortItems(items, 'priority', 'desc')
    expect(result.map(i => i.id)).toEqual(['2', '3', '1'])
  })
})

describe('sortItems by title', () => {
  it('sorts ascending (A–Z)', () => {
    const items = [
      makeItem({ id: '1', title: 'Zebra' }),
      makeItem({ id: '2', title: 'Apple' }),
      makeItem({ id: '3', title: 'Mango' }),
    ]
    const result = sortItems(items, 'title', 'asc')
    expect(result.map(i => i.title)).toEqual(['Apple', 'Mango', 'Zebra'])
  })

  it('sorts descending (Z–A)', () => {
    const items = [
      makeItem({ id: '1', title: 'Apple' }),
      makeItem({ id: '2', title: 'Zebra' }),
    ]
    const result = sortItems(items, 'title', 'desc')
    expect(result[0].title).toBe('Zebra')
  })
})

describe('sortItems by updatedAt', () => {
  it('sorts ascending (oldest first)', () => {
    const items = [
      makeItem({ id: '1', updatedAt: '2026-03-01T00:00:00.000Z' }),
      makeItem({ id: '2', updatedAt: '2026-01-01T00:00:00.000Z' }),
      makeItem({ id: '3', updatedAt: '2026-02-01T00:00:00.000Z' }),
    ]
    const result = sortItems(items, 'updatedAt', 'asc')
    expect(result.map(i => i.id)).toEqual(['2', '3', '1'])
  })

  it('sorts descending (newest first)', () => {
    const items = [
      makeItem({ id: '1', updatedAt: '2026-01-01T00:00:00.000Z' }),
      makeItem({ id: '2', updatedAt: '2026-03-01T00:00:00.000Z' }),
    ]
    const result = sortItems(items, 'updatedAt', 'desc')
    expect(result[0].id).toBe('2')
  })
})

describe('sortItems does not mutate original array', () => {
  it('returns new array', () => {
    const items = [makeItem({ id: '1', priority: 2 }), makeItem({ id: '2', priority: 0 })]
    const original = [...items]
    sortItems(items, 'priority', 'asc')
    expect(items.map(i => i.id)).toEqual(original.map(i => i.id))
  })
})
