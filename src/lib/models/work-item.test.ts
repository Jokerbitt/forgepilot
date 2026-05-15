import { describe, it, expect } from 'vitest'
import type { WorkItem, WorkItemStatus, RiskClass } from './work-item'

describe('WorkItem type', () => {
  it('accepts a valid WorkItem with all required fields', () => {
    const item: WorkItem = {
      id: 'lin-1',
      source: 'linear',
      type: 'ticket',
      title: 'Fix login bug',
      url: 'https://linear.app/issue/JOK-1',
      projectId: 'proj-1',
      status: 'todo',
      priority: 2,
      blocked: false,
      risk: 'A',
      aiDelegable: true,
      updatedAt: '2026-05-15T10:00:00Z',
      createdAt: '2026-05-15T09:00:00Z',
    }
    expect(item.id).toBe('lin-1')
    expect(item.source).toBe('linear')
    expect(item.priority).toBe(2)
  })

  it('accepts optional fields', () => {
    const item: WorkItem = {
      id: 'gh-1',
      source: 'github',
      type: 'pr',
      title: 'feat: add NBA Engine',
      url: 'https://github.com/Jokerbitt/forgepilot/pull/1',
      projectId: 'proj-1',
      status: 'in-review',
      priority: 1,
      blocked: true,
      blockedBy: ['lin-2'],
      risk: 'B',
      aiDelegable: false,
      estimatedMinutes: 120,
      costEstimateUsd: 0.5,
      labels: ['feature', 'nba'],
      assigneeId: 'user-1',
      updatedAt: '2026-05-15T11:00:00Z',
      createdAt: '2026-05-14T09:00:00Z',
    }
    expect(item.blocked).toBe(true)
    expect(item.blockedBy).toHaveLength(1)
    expect(item.labels).toContain('feature')
  })

  it('covers all WorkItemStatus values', () => {
    const statuses: WorkItemStatus[] = ['backlog', 'todo', 'in-progress', 'in-review', 'done', 'cancelled']
    expect(statuses).toHaveLength(6)
  })

  it('covers all RiskClass values', () => {
    const classes: RiskClass[] = ['A', 'B', 'C']
    expect(classes).toHaveLength(3)
  })

  it('priority 0 is urgent', () => {
    const item: WorkItem = {
      id: 'urgent-1',
      source: 'linear',
      type: 'ticket',
      title: 'Critical outage',
      url: 'https://linear.app/issue/JOK-99',
      projectId: 'proj-1',
      status: 'in-progress',
      priority: 0,
      blocked: false,
      risk: 'C',
      aiDelegable: false,
      updatedAt: '2026-05-15T10:00:00Z',
      createdAt: '2026-05-15T10:00:00Z',
    }
    expect(item.priority).toBe(0)
    expect(item.risk).toBe('C')
  })
})
