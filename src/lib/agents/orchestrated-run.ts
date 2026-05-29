/**
 * Orchestrated Run Store
 *
 * An OrchestratedRun is the execution context for a delegation broken into
 * AtomicTasks. Each task gets assigned to the best-fit agent, tracked, and
 * validated by the quality scorer before marking done.
 */

import fs from 'fs'
import path from 'path'
import type { AtomicTask, AtomicTaskStatus } from './atomic-task'
import type { AgentType } from './agent-skills'
import { isProcessAlive } from '@/lib/process-registry'

const STORE_PATH = path.join(process.cwd(), 'config', 'orchestrated-runs.json')

export type RunStatus = 'planning' | 'running' | 'done' | 'failed' | 'aborted'

export interface TaskResult {
  qualityScore: number
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  issues: string[]
  testsPassed: boolean
  typeErrorCount: number
  lintErrorCount: number
  completedAt: string
}

export interface OrchestratedTaskEntry {
  task: AtomicTask
  status: AtomicTaskStatus
  agentId?: string
  agentType: AgentType
  startedAt?: string
  result?: TaskResult
  retryCount: number
}

export interface OrchestratedRun {
  id: string
  delegationId: string
  delegationTitle: string
  goal: string
  status: RunStatus
  tasks: OrchestratedTaskEntry[]
  currentTaskIndex: number
  overallQualityScore?: number
  /** Max automatic retries per task (default 2) */
  maxRetries: number
  createdAt: string
  updatedAt: string
  completedAt?: string
}

export interface RunWatchdogOptions {
  now?: Date
  /** Planning run without execution after this many minutes is failed. */
  planningTimeoutMinutes?: number
  /** Running task without an alive process after this many minutes is failed. */
  runningTaskGraceMinutes?: number
  /** Whole running run older than this is failed as a hard stop. */
  runTimeoutMinutes?: number
  processAlive?: (delegationId: string) => boolean
}

export interface ReapedRun {
  runId: string
  taskIds: string[]
  reason: string
}

interface RunStore {
  runs: OrchestratedRun[]
}

// ─── Storage helpers ──────────────────────────────────────────────────────────

function read(): RunStore {
  try {
    if (!fs.existsSync(STORE_PATH)) return { runs: [] }
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8')) as RunStore
  } catch {
    return { runs: [] }
  }
}

function write(store: RunStore): void {
  const dir = path.dirname(STORE_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const tmp = STORE_PATH + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2))
  fs.renameSync(tmp, STORE_PATH)
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export function createRun(
  delegationId: string,
  delegationTitle: string,
  goal: string,
  tasks: AtomicTask[],
): OrchestratedRun {
  const store = read()
  const now = new Date().toISOString()

  const run: OrchestratedRun = {
    id: `run-${Date.now()}`,
    delegationId,
    delegationTitle,
    goal,
    status: 'planning',
    tasks: tasks.map(t => ({
      task: t,
      status: 'pending',
      agentType: t.assignedAgentType,
      retryCount: 0,
    })),
    currentTaskIndex: 0,
    maxRetries: 2,
    createdAt: now,
    updatedAt: now,
  }

  store.runs.push(run)

  // Store rotation: cap at 100 runs, dropping oldest terminal-status runs first
  const MAX_RUNS = 100
  if (store.runs.length > MAX_RUNS) {
    const terminalStatuses: RunStatus[] = ['done', 'failed', 'aborted']
    const terminal = store.runs.filter(r => terminalStatuses.includes(r.status))
    const active   = store.runs.filter(r => !terminalStatuses.includes(r.status))
    const keepTerminal = Math.max(MAX_RUNS - active.length, 0)
    const trimmedTerminal = terminal
      .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
      .slice(-keepTerminal)
    store.runs = [...active, ...trimmedTerminal]
  }

  write(store)
  return run
}

export function getRun(id: string): OrchestratedRun | undefined {
  return read().runs.find(r => r.id === id)
}

export function listRuns(delegationId?: string): OrchestratedRun[] {
  reapStaleRuns()
  const { runs } = read()
  if (delegationId) return runs.filter(r => r.delegationId === delegationId)
  return runs.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function setTaskAgentId(
  runId: string,
  taskId: string,
  agentId: string,
): OrchestratedRun | undefined {
  const store = read()
  const run = store.runs.find(r => r.id === runId)
  if (!run) return undefined

  const entry = run.tasks.find(t => t.task.id === taskId)
  if (!entry) return undefined

  entry.agentId = agentId
  run.updatedAt = new Date().toISOString()
  write(store)
  return run
}

export function updateTaskStatus(
  runId: string,
  taskId: string,
  status: AtomicTaskStatus,
  result?: TaskResult,
): OrchestratedRun | undefined {
  const store = read()
  const run = store.runs.find(r => r.id === runId)
  if (!run) return undefined

  const entry = run.tasks.find(t => t.task.id === taskId)
  if (!entry) return undefined

  entry.status = status
  if (status === 'running') entry.startedAt = new Date().toISOString()
  if (result) entry.result = result

  // Advance pointer to next pending task
  if (status === 'done' || status === 'failed' || status === 'skipped') {
    const nextIdx = run.tasks.findIndex(
      (t, i) => i > run.currentTaskIndex && t.status === 'pending',
    )
    run.currentTaskIndex = nextIdx >= 0 ? nextIdx : run.tasks.length
  }

  // Compute overall status
  const allDone = run.tasks.every(t => ['done', 'skipped'].includes(t.status))
  const anyFailed = run.tasks.some(t => t.status === 'failed')
  if (allDone) {
    run.status = 'done'
    run.completedAt = new Date().toISOString()
    const scores = run.tasks.filter(t => t.result).map(t => t.result!.qualityScore)
    run.overallQualityScore = scores.length
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : undefined
  } else if (anyFailed && run.status !== 'running') {
    run.status = 'failed'
  } else {
    run.status = 'running'
  }

  run.updatedAt = new Date().toISOString()
  write(store)
  return run
}

export function updateRunStatus(runId: string, status: RunStatus): void {
  const store = read()
  const run = store.runs.find(r => r.id === runId)
  if (!run) return
  run.status = status
  run.updatedAt = new Date().toISOString()
  write(store)
}

export function reapStaleRuns(options: RunWatchdogOptions = {}): ReapedRun[] {
  const now = options.now ?? new Date()
  const planningTimeoutMinutes = options.planningTimeoutMinutes ?? 30
  const runningTaskGraceMinutes = options.runningTaskGraceMinutes ?? 2
  const runTimeoutMinutes = options.runTimeoutMinutes ?? 30
  const processAlive = options.processAlive ?? isProcessAlive
  const store = read()
  const reaped: ReapedRun[] = []

  for (const run of store.runs) {
    const startedMs = new Date(run.createdAt).getTime()
    const runAgeMinutes = Math.max(0, Math.round((now.getTime() - startedMs) / 60_000))

    if (run.status === 'planning' && runAgeMinutes >= planningTimeoutMinutes) {
      for (const entry of run.tasks) {
        if (entry.status !== 'pending') continue
        entry.status = 'failed'
        entry.result = {
          qualityScore: 0,
          grade: 'F',
          issues: [`Watchdog marked planning task stale after ${runAgeMinutes}m without execution.`],
          testsPassed: false,
          typeErrorCount: 0,
          lintErrorCount: 0,
          completedAt: now.toISOString(),
        }
      }
      run.status = 'failed'
      run.currentTaskIndex = run.tasks.length
      run.updatedAt = now.toISOString()
      run.completedAt = now.toISOString()
      reaped.push({
        runId: run.id,
        taskIds: run.tasks.map(entry => entry.task.id),
        reason: 'planning run had no execution beyond watchdog timeout',
      })
      continue
    }

    if (run.status !== 'running') continue

    const failedTaskIds: string[] = []

    for (const entry of run.tasks) {
      if (entry.status !== 'running') continue
      const taskStartedMs = entry.startedAt ? new Date(entry.startedAt).getTime() : new Date(run.updatedAt).getTime()
      const silentMinutes = Math.max(0, Math.round((now.getTime() - taskStartedMs) / 60_000))
      const hasLiveProcess = entry.agentId ? processAlive(entry.agentId) : false
      const exceededGrace = silentMinutes >= runningTaskGraceMinutes || runAgeMinutes >= runTimeoutMinutes

      if (!hasLiveProcess && exceededGrace) {
        entry.status = 'failed'
        entry.result = {
          qualityScore: 0,
          grade: 'F',
          issues: [`Watchdog marked task stale after ${silentMinutes}m without a live process.`],
          testsPassed: false,
          typeErrorCount: 0,
          lintErrorCount: 0,
          completedAt: now.toISOString(),
        }
        failedTaskIds.push(entry.task.id)
      }
    }

    if (failedTaskIds.length > 0) {
      run.status = 'failed'
      run.currentTaskIndex = run.tasks.length
      run.updatedAt = now.toISOString()
      run.completedAt = now.toISOString()
      reaped.push({
        runId: run.id,
        taskIds: failedTaskIds,
        reason: 'running task had no live process beyond watchdog grace period',
      })
    }
  }

  if (reaped.length > 0) write(store)
  return reaped
}

/** Returns true if the task can be retried (failed + retryCount < maxRetries) */
export function canRetry(runId: string, taskId: string): boolean {
  const run = getRun(runId)
  if (!run) return false
  const entry = run.tasks.find(t => t.task.id === taskId)
  if (!entry) return false
  return entry.status === 'failed' && entry.retryCount < run.maxRetries
}

/** Reset a failed task to pending and increment retryCount */
export function retryTask(runId: string, taskId: string): OrchestratedRun | undefined {
  const store = read()
  const run = store.runs.find(r => r.id === runId)
  if (!run) return undefined
  const entry = run.tasks.find(t => t.task.id === taskId)
  if (!entry || entry.status !== 'failed') return undefined
  if (entry.retryCount >= run.maxRetries) return undefined

  entry.status = 'pending'
  entry.retryCount += 1
  entry.result = undefined
  entry.startedAt = undefined

  // Reset run status to running if it was failed
  if (run.status === 'failed') run.status = 'running'

  run.updatedAt = new Date().toISOString()
  write(store)
  return run
}
