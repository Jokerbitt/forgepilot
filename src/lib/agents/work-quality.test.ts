import { describe, it, expect } from 'vitest'
import { scoreWork, shouldRetry, improvementHints } from './work-quality'
import type { AtomicTask } from './atomic-task'

const BASE_TASK: AtomicTask = {
  id: 'task-1',
  title: 'Test task',
  description: 'A test task',
  acceptanceCriteria: ['Tests pass', 'TypeScript 0 errors'],
  skillCategory: 'api-route',
  assignedAgentType: 'claude-code',
  filePatterns: ['src/**/*.ts'],
  effort: 'M',
  dependsOn: [],
  order: 0,
}

describe('scoreWork', () => {
  it('returns perfect score for clean work', () => {
    const result = scoreWork({
      task: BASE_TASK,
      testsPassed: true,
      typeErrorCount: 0,
      lintErrorCount: 0,
      filesChanged: 3,
      retryCount: 0,
      durationMinutes: 30,
    })
    expect(result.qualityScore).toBe(100)
    expect(result.grade).toBe('A')
    expect(result.issues).toHaveLength(0)
  })

  it('penalizes TypeScript errors', () => {
    const result = scoreWork({
      task: BASE_TASK,
      testsPassed: true,
      typeErrorCount: 2,
      lintErrorCount: 0,
      filesChanged: 2,
      retryCount: 0,
      durationMinutes: 20,
    })
    expect(result.qualityScore).toBeLessThan(70)
    expect(result.issues.some(i => i.includes('TypeScript'))).toBe(true)
  })

  it('penalizes test failures', () => {
    const result = scoreWork({
      task: BASE_TASK,
      testsPassed: false,
      typeErrorCount: 0,
      lintErrorCount: 0,
      filesChanged: 2,
      retryCount: 0,
      durationMinutes: 20,
    })
    expect(result.qualityScore).toBeLessThanOrEqual(70)
    expect(result.issues.some(i => i.includes('Tests'))).toBe(true)
  })

  it('penalizes scope creep (too many files)', () => {
    const result = scoreWork({
      task: { ...BASE_TASK, effort: 'S' },
      testsPassed: true,
      typeErrorCount: 0,
      lintErrorCount: 0,
      filesChanged: 10, // S effort allows max 3
      retryCount: 0,
      durationMinutes: 10,
    })
    expect(result.issues.some(i => i.includes('Too many files'))).toBe(true)
  })

  it('penalizes retries', () => {
    const result = scoreWork({
      task: BASE_TASK,
      testsPassed: true,
      typeErrorCount: 0,
      lintErrorCount: 0,
      filesChanged: 2,
      retryCount: 2,
      durationMinutes: 30,
    })
    expect(result.qualityScore).toBeLessThan(100)
    expect(result.issues.some(i => i.includes('retry'))).toBe(true)
  })

  it('never goes below 0', () => {
    const result = scoreWork({
      task: BASE_TASK,
      testsPassed: false,
      typeErrorCount: 10,
      lintErrorCount: 10,
      filesChanged: 20,
      retryCount: 5,
      durationMinutes: 300,
    })
    expect(result.qualityScore).toBeGreaterThanOrEqual(0)
  })

  it('grades F for very low score', () => {
    const result = scoreWork({
      task: BASE_TASK,
      testsPassed: false,
      typeErrorCount: 5,
      lintErrorCount: 5,
      filesChanged: 20,
      retryCount: 3,
      durationMinutes: 200,
    })
    expect(result.grade).toBe('F')
  })
})

describe('shouldRetry', () => {
  it('returns true for F grade when retries remain', () => {
    const result = scoreWork({
      task: BASE_TASK,
      testsPassed: false,
      typeErrorCount: 3,
      lintErrorCount: 3,
      filesChanged: 15,
      retryCount: 0,
      durationMinutes: 10,
    })
    expect(shouldRetry(result, 2, 0)).toBe(true)
  })

  it('returns false when max retries reached', () => {
    const result = scoreWork({
      task: BASE_TASK,
      testsPassed: false,
      typeErrorCount: 3,
      lintErrorCount: 3,
      filesChanged: 15,
      retryCount: 2,
      durationMinutes: 10,
    })
    expect(shouldRetry(result, 2, 2)).toBe(false)
  })
})

describe('improvementHints', () => {
  it('suggests fixing TypeScript errors', () => {
    const result = scoreWork({
      task: BASE_TASK,
      testsPassed: true,
      typeErrorCount: 2,
      lintErrorCount: 0,
      filesChanged: 2,
      retryCount: 0,
      durationMinutes: 20,
    })
    const hints = improvementHints(result)
    expect(hints.some(h => h.includes('TypeScript'))).toBe(true)
  })

  it('returns empty hints for perfect score', () => {
    const result = scoreWork({
      task: BASE_TASK,
      testsPassed: true,
      typeErrorCount: 0,
      lintErrorCount: 0,
      filesChanged: 2,
      retryCount: 0,
      durationMinutes: 20,
    })
    expect(improvementHints(result)).toHaveLength(0)
  })
})
