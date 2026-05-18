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
  createdAt: string
  updatedAt: string
  completedAt?: string
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
    createdAt: now,
    updatedAt: now,
  }

  store.runs.push(run)
  write(store)
  return run
}

export function getRun(id: string): OrchestratedRun | undefined {
  return read().runs.find(r => r.id === id)
}

export function listRuns(delegationId?: string): OrchestratedRun[] {
  const { runs } = read()
  if (delegationId) return runs.filter(r => r.delegationId === delegationId)
  return runs.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
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
