import { describe, it, expect } from 'vitest'
import {
  getPriorityConfig,
  getStatusConfig,
  getVisibleIssues,
} from './CriticalPathWidget'
import type { CriticalPathIssue } from './CriticalPathWidget'

// ─── Factory ──────────────────────────────────────────────────────────────────

function makeIssue(overrides: Partial<CriticalPathIssue> = {}): CriticalPathIssue {
  return {
    id: overrides.id ?? 'jok-1',
    title: overrides.title ?? 'Test Issue',
    status: overrides.status ?? 'In Progress',
    priority: overrides.priority ?? 3,
    blockedBy: overrides.blockedBy ?? [],
  }
}

// ─── getPriorityConfig ────────────────────────────────────────────────────────

describe('getPriorityConfig', () => {
  it('returns Urgent for priority 1', () => {
    const config = getPriorityConfig(1)
    expect(config.label).toBe('Urgent')
    expect(config.className).toContain('red')
  })

  it('returns High for priority 2', () => {
    const config = getPriorityConfig(2)
    expect(config.label).toBe('High')
    expect(config.className).toContain('orange')
  })

  it('returns Medium for priority 3', () => {
    const config = getPriorityConfig(3)
    expect(config.label).toBe('Medium')
    expect(config.className).toContain('yellow')
  })

  it('returns Low for priority 4', () => {
    const config = getPriorityConfig(4)
    expect(config.label).toBe('Low')
    expect(config.className).toContain('gray')
  })

  it('returns Low for unknown priority', () => {
    const config = getPriorityConfig(99)
    expect(config.label).toBe('Low')
  })
})

// ─── getStatusConfig ──────────────────────────────────────────────────────────

describe('getStatusConfig', () => {
  it('returns emerald class for done status', () => {
    expect(getStatusConfig('Done')).toContain('emerald')
    expect(getStatusConfig('Completed')).toContain('emerald')
  })

  it('returns sky class for in-progress status', () => {
    expect(getStatusConfig('In Progress')).toContain('sky')
    expect(getStatusConfig('Started')).toContain('sky')
  })

  it('returns rose class for blocked status', () => {
    expect(getStatusConfig('Blocked')).toContain('rose')
    expect(getStatusConfig('Waiting')).toContain('rose')
  })

  it('returns violet class for review status', () => {
    expect(getStatusConfig('In Review')).toContain('violet')
  })

  it('returns gray class for unknown status', () => {
    expect(getStatusConfig('Backlog')).toContain('gray')
  })
})

// ─── getVisibleIssues ─────────────────────────────────────────────────────────

describe('getVisibleIssues', () => {
  it('returns all issues when count is below max (8)', () => {
    const issues = Array.from({ length: 5 }, (_, i) =>
      makeIssue({ id: `jok-${i}`, title: `Issue ${i}` }),
    )
    const { visible, hidden } = getVisibleIssues(issues)
    expect(visible).toHaveLength(5)
    expect(hidden).toBe(0)
  })

  it('returns empty arrays for empty input', () => {
    const { visible, hidden } = getVisibleIssues([])
    expect(visible).toHaveLength(0)
    expect(hidden).toBe(0)
  })

  it('caps visible at 8 and reports hidden count', () => {
    const issues = Array.from({ length: 12 }, (_, i) =>
      makeIssue({ id: `jok-${i}`, title: `Issue ${i}` }),
    )
    const { visible, hidden } = getVisibleIssues(issues)
    expect(visible).toHaveLength(8)
    expect(hidden).toBe(4)
  })

  it('shows issue titles in visible set', () => {
    const issues = [
      makeIssue({ id: 'jok-1', title: 'First critical issue' }),
      makeIssue({ id: 'jok-2', title: 'Second critical issue' }),
    ]
    const { visible } = getVisibleIssues(issues)
    expect(visible.map(i => i.title)).toContain('First critical issue')
    expect(visible.map(i => i.title)).toContain('Second critical issue')
  })

  it('returns exactly 8 visible items when count equals max', () => {
    const issues = Array.from({ length: 8 }, (_, i) =>
      makeIssue({ id: `jok-${i}` }),
    )
    const { visible, hidden } = getVisibleIssues(issues)
    expect(visible).toHaveLength(8)
    expect(hidden).toBe(0)
  })
})

// ─── Data shape invariants ────────────────────────────────────────────────────

describe('CriticalPathIssue shape', () => {
  it('has required fields', () => {
    const issue = makeIssue()
    expect(issue).toHaveProperty('id')
    expect(issue).toHaveProperty('title')
    expect(issue).toHaveProperty('status')
    expect(issue).toHaveProperty('priority')
    expect(issue).toHaveProperty('blockedBy')
    expect(Array.isArray(issue.blockedBy)).toBe(true)
  })

  it('blockedBy defaults to empty array', () => {
    const issue = makeIssue()
    expect(issue.blockedBy).toHaveLength(0)
  })

  it('handles issue with multiple blockers', () => {
    const issue = makeIssue({ blockedBy: ['jok-5', 'jok-6'] })
    expect(issue.blockedBy).toHaveLength(2)
  })
})
