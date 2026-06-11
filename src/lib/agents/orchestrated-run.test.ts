import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock fs so we don't touch disk — store is reset before each test
let mockStore = '{"runs":[]}'
vi.mock('fs', () => ({
  default: {
    existsSync: () => true,
    readFileSync: () => mockStore,
    writeFileSync: (_p: string, data: string) => { mockStore = data },
    renameSync: () => {},
    mkdirSync: () => {},
  },
}))

// We need to re-import after mocking, but vitest handles module isolation per file
import {
  createRun,
  getRun,
  reapStaleRuns,
  setTaskAgentId,
  updateTaskStatus,
  retryTask,
  canRetry,
  listRuns,
} from './orchestrated-run'
import type { AtomicTask } from './atomic-task'

function makeTask(id: string): AtomicTask {
  return {
    id,
    title: `Task ${id}`,
    description: 'desc',
    acceptanceCriteria: ['done'],
    skillCategory: 'api-route',
    assignedAgentType: 'claude-code',
    filePatterns: [],
    effort: 'S',
    dependsOn: [],
    order: 0,
  }
}

function makeResult(grade: 'A' | 'B' | 'C' | 'D' | 'F' = 'F') {
  return {
    qualityScore: grade === 'A' ? 95 : grade === 'F' ? 30 : 75,
    grade,
    issues: [],
    testsPassed: grade !== 'F',
    typeErrorCount: 0,
    lintErrorCount: 0,
    completedAt: new Date().toISOString(),
  }
}

describe('orchestrated-run', () => {
  let runId: string

  beforeEach(() => {
    mockStore = '{"runs":[]}'
    const run = createRun('del-1', 'Test Delegation', 'Build something', [
      makeTask('t1'),
      makeTask('t2'),
    ])
    runId = run.id
  })

  it('creates a run with maxRetries=2 by default', () => {
    const run = getRun(runId)
    expect(run).toBeDefined()
    expect(run!.maxRetries).toBe(2)
    expect(run!.tasks).toHaveLength(2)
    expect(run!.tasks[0].retryCount).toBe(0)
  })

  it('canRetry returns false for pending task', () => {
    expect(canRetry(runId, 't1')).toBe(false)
  })

  it('canRetry returns true for failed task within limit', () => {
    updateTaskStatus(runId, 't1', 'failed', makeResult('F'))
    expect(canRetry(runId, 't1')).toBe(true)
  })

  it('canRetry returns false after max retries exhausted', () => {
    updateTaskStatus(runId, 't1', 'failed', makeResult('F'))
    retryTask(runId, 't1')
    updateTaskStatus(runId, 't1', 'failed', makeResult('F'))
    retryTask(runId, 't1')
    updateTaskStatus(runId, 't1', 'failed', makeResult('F'))
    // retryCount is now 2, maxRetries is 2 → cannot retry
    expect(canRetry(runId, 't1')).toBe(false)
  })

  it('retryTask resets status to pending and increments retryCount', () => {
    updateTaskStatus(runId, 't1', 'failed', makeResult('F'))
    const updated = retryTask(runId, 't1')
    expect(updated).toBeDefined()
    const entry = updated!.tasks.find(t => t.task.id === 't1')!
    expect(entry.status).toBe('pending')
    expect(entry.retryCount).toBe(1)
    expect(entry.result).toBeUndefined()
  })

  it('retryTask resets run status from failed to running', () => {
    updateTaskStatus(runId, 't1', 'failed', makeResult('F'))
    retryTask(runId, 't1')
    const run = getRun(runId)
    expect(run!.status).toBe('running')
  })

  it('retryTask returns undefined for non-failed task', () => {
    updateTaskStatus(runId, 't1', 'running')
    expect(retryTask(runId, 't1')).toBeUndefined()
  })

  it('run completes when all tasks done', () => {
    updateTaskStatus(runId, 't1', 'done', makeResult('A'))
    updateTaskStatus(runId, 't2', 'done', makeResult('B'))
    const run = getRun(runId)
    expect(run!.status).toBe('done')
    expect(run!.overallQualityScore).toBeDefined()
  })

  it('listRuns filters by delegationId', () => {
    createRun('del-2', 'Other', 'goal', [makeTask('t3')])
    const forDel1 = listRuns('del-1')
    expect(forDel1.every(r => r.delegationId === 'del-1')).toBe(true)
  })

  it('stores the child delegation id for a running task', () => {
    updateTaskStatus(runId, 't1', 'running')
    const updated = setTaskAgentId(runId, 't1', 'child-delegation-1')
    expect(updated?.tasks[0].agentId).toBe('child-delegation-1')
    expect(getRun(runId)?.tasks[0].agentId).toBe('child-delegation-1')
  })

  it('watchdog fails a stale running task when no process is alive', () => {
    updateTaskStatus(runId, 't1', 'running')
    setTaskAgentId(runId, 't1', 'child-delegation-1')
    const started = new Date(getRun(runId)!.tasks[0].startedAt!)
    const reaped = reapStaleRuns({
      now: new Date(started.getTime() + 5 * 60_000),
      runningTaskGraceMinutes: 2,
      processAlive: () => false,
    })

    expect(reaped).toHaveLength(1)
    expect(reaped[0].runId).toBe(runId)
    const run = getRun(runId)
    expect(run?.status).toBe('failed')
    expect(run?.tasks[0].status).toBe('failed')
    expect(run?.tasks[0].result?.issues[0]).toContain('Watchdog marked task stale')
  })

  it('watchdog leaves a running task alone while its process is alive', () => {
    updateTaskStatus(runId, 't1', 'running')
    setTaskAgentId(runId, 't1', 'child-delegation-1')
    const started = new Date(getRun(runId)!.tasks[0].startedAt!)
    const reaped = reapStaleRuns({
      now: new Date(started.getTime() + 20 * 60_000),
      runningTaskGraceMinutes: 2,
      processAlive: () => true,
    })

    expect(reaped).toEqual([])
    expect(getRun(runId)?.status).toBe('running')
    expect(getRun(runId)?.tasks[0].status).toBe('running')
  })

  it('watchdog fails stale planning runs that never started execution', () => {
    const created = new Date(getRun(runId)!.createdAt)
    const reaped = reapStaleRuns({
      now: new Date(created.getTime() + 60 * 60_000),
      planningTimeoutMinutes: 30,
    })

    expect(reaped).toHaveLength(1)
    expect(reaped[0]).toMatchObject({
      runId,
      reason: 'planning run had no execution beyond watchdog timeout',
    })
    const run = getRun(runId)
    expect(run?.status).toBe('failed')
    expect(run?.tasks.every(task => task.status === 'failed')).toBe(true)
    expect(run?.tasks[0].result?.issues[0]).toContain('planning task stale')
  })
})
