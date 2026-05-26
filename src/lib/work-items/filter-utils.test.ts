import { describe, it, expect } from 'vitest'
import type { WorkItem, WorkItemStatus } from '@/lib/models/work-item'
import {
  countByStatusGroup,
  filterByStatusGroup,
  getStatusGroup,
  STATUS_GROUP_TO_DEFAULT_STATUS,
} from './filter-utils'

function makeItem(id: string, status: WorkItemStatus): WorkItem {
  return {
    id,
    source: 'local',
    type: 'ticket',
    title: `Item ${id}`,
    url: '',
    projectId: 'proj',
    status,
    priority: 2,
    blocked: false,
    risk: 'A',
    aiDelegable: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

describe('getStatusGroup', () => {
  it('maps backlog and todo to open', () => {
    expect(getStatusGroup('backlog')).toBe('open')
    expect(getStatusGroup('todo')).toBe('open')
  })

  it('maps in-progress and in-review to in_progress', () => {
    expect(getStatusGroup('in-progress')).toBe('in_progress')
    expect(getStatusGroup('in-review')).toBe('in_progress')
  })

  it('maps done and cancelled to done', () => {
    expect(getStatusGroup('done')).toBe('done')
    expect(getStatusGroup('cancelled')).toBe('done')
  })
})

describe('filterByStatusGroup', () => {
  const items = [
    makeItem('a', 'backlog'),
    makeItem('b', 'todo'),
    makeItem('c', 'in-progress'),
    makeItem('d', 'in-review'),
    makeItem('e', 'done'),
    makeItem('f', 'cancelled'),
  ]

  it('returns all items for "all"', () => {
    expect(filterByStatusGroup(items, 'all')).toHaveLength(6)
  })

  it('returns only open items for "open"', () => {
    expect(filterByStatusGroup(items, 'open').map(i => i.id)).toEqual(['a', 'b'])
  })

  it('returns only in-progress items for "in_progress"', () => {
    expect(filterByStatusGroup(items, 'in_progress').map(i => i.id)).toEqual(['c', 'd'])
  })

  it('returns only done items for "done"', () => {
    expect(filterByStatusGroup(items, 'done').map(i => i.id)).toEqual(['e', 'f'])
  })
})

describe('countByStatusGroup', () => {
  it('counts items per group', () => {
    const items = [
      makeItem('a', 'todo'),
      makeItem('b', 'todo'),
      makeItem('c', 'in-progress'),
      makeItem('d', 'done'),
      makeItem('e', 'cancelled'),
    ]
    expect(countByStatusGroup(items)).toEqual({ open: 2, in_progress: 1, done: 2 })
  })

  it('returns zero counts for empty list', () => {
    expect(countByStatusGroup([])).toEqual({ open: 0, in_progress: 0, done: 0 })
  })
})

describe('STATUS_GROUP_TO_DEFAULT_STATUS', () => {
  it('maps each group to a representative status', () => {
    expect(STATUS_GROUP_TO_DEFAULT_STATUS.open).toBe('todo')
    expect(STATUS_GROUP_TO_DEFAULT_STATUS.in_progress).toBe('in-progress')
    expect(STATUS_GROUP_TO_DEFAULT_STATUS.done).toBe('done')
  })
})
