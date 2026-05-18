import { describe, it, expect } from 'vitest'
import { decomposeTask, effortMinutes } from './atomic-task'

describe('decomposeTask', () => {
  it('matches api-route pattern', () => {
    const tasks = decomposeTask('Build API route for user settings endpoint')
    expect(tasks.length).toBeGreaterThanOrEqual(2)
    const categories = tasks.map(t => t.skillCategory)
    expect(categories).toContain('api-route')
  })

  it('matches ui-component pattern', () => {
    const tasks = decomposeTask('Build dashboard UI component for analytics')
    const categories = tasks.map(t => t.skillCategory)
    expect(categories).toContain('ui-component')
  })

  it('matches model pattern', () => {
    const tasks = decomposeTask('Define domain model for projects')
    const categories = tasks.map(t => t.skillCategory)
    expect(categories).toContain('data-model')
  })

  it('matches test pattern', () => {
    const tasks = decomposeTask('Add tests for delegation service')
    const categories = tasks.map(t => t.skillCategory)
    expect(categories).toContain('test')
  })

  it('matches refactor pattern', () => {
    const tasks = decomposeTask('Refactor auth module to extract helpers')
    const categories = tasks.map(t => t.skillCategory)
    expect(categories).toContain('refactor')
  })

  it('falls back to generic tasks when no pattern matches', () => {
    const tasks = decomposeTask('Do something completely unrelated xyz123')
    expect(tasks.length).toBeGreaterThanOrEqual(1)
    tasks.forEach(t => {
      expect(t.id).toBeTruthy()
      expect(t.title).toBeTruthy()
      expect(t.acceptanceCriteria.length).toBeGreaterThan(0)
    })
  })

  it('assigns unique ids to each task', () => {
    const tasks = decomposeTask('Build API route for notifications')
    const ids = tasks.map(t => t.id)
    const unique = new Set(ids)
    expect(unique.size).toBe(ids.length)
  })

  it('assigns correct order indices', () => {
    const tasks = decomposeTask('Build API route for search')
    tasks.forEach((t, i) => {
      expect(t.order).toBe(i)
    })
  })

  it('assigns an agentType to each task', () => {
    const tasks = decomposeTask('Build a ui component for settings page')
    tasks.forEach(t => {
      expect(t.assignedAgentType).toBeTruthy()
    })
  })

  it('uses context to influence pattern selection', () => {
    const tasks = decomposeTask('improve thing', 'needs api route and tests')
    const categories = tasks.map(t => t.skillCategory)
    // context contains "api route" → should match api-route pattern
    expect(categories).toContain('api-route')
  })
})

describe('effortMinutes', () => {
  it('returns 15 for S', () => expect(effortMinutes('S')).toBe(15))
  it('returns 45 for M', () => expect(effortMinutes('M')).toBe(45))
  it('returns 120 for L', () => expect(effortMinutes('L')).toBe(120))
})
