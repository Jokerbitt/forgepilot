import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import type { AgentRun, TraceEvent } from '@/lib/models/agent-run'

function storePath(): string {
  return path.join(process.cwd(), 'config', 'agent-runs.json')
}

interface AgentRunStore {
  runs: AgentRun[]
}

function readStore(): AgentRunStore {
  try {
    if (!fs.existsSync(storePath())) return { runs: [] }
    return JSON.parse(fs.readFileSync(storePath(), 'utf-8')) as AgentRunStore
  } catch {
    return { runs: [] }
  }
}

function writeStore(store: AgentRunStore): void {
  const dir = path.dirname(storePath())
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(storePath(), JSON.stringify(store, null, 2))
}

export function createRun(
  delegationId: string,
  contractId: string,
  model: string,
): AgentRun {
  const run: AgentRun = {
    id: randomUUID(),
    delegationId,
    contractId,
    status: 'queued',
    model,
    startedAt: new Date().toISOString(),
    totalCostUsd: 0,
    tokenInput: 0,
    tokenOutput: 0,
    traceEvents: [],
  }
  const store = readStore()
  store.runs.push(run)
  writeStore(store)
  return run
}

export function getRun(id: string): AgentRun | undefined {
  return readStore().runs.find(r => r.id === id)
}

export function getRuns(delegationId?: string): AgentRun[] {
  const store = readStore()
  if (delegationId) return store.runs.filter(r => r.delegationId === delegationId)
  return store.runs
}

export function updateRun(id: string, patch: Partial<AgentRun>): AgentRun | undefined {
  const store = readStore()
  const idx = store.runs.findIndex(r => r.id === id)
  if (idx < 0) return undefined
  store.runs[idx] = { ...store.runs[idx], ...patch }
  writeStore(store)
  return store.runs[idx]
}

export function appendTraceEvent(runId: string, event: Omit<TraceEvent, 'id' | 'agentRunId'>): TraceEvent | undefined {
  const store = readStore()
  const run = store.runs.find(r => r.id === runId)
  if (!run) return undefined

  const full: TraceEvent = {
    id: randomUUID(),
    agentRunId: runId,
    ...event,
  }
  run.traceEvents.push(full)

  if (event.costUsd) {
    run.totalCostUsd = (run.totalCostUsd ?? 0) + event.costUsd
  }
  if (event.type === 'cost_update' && typeof event.data.inputTokens === 'number') {
    run.tokenInput += event.data.inputTokens as number
  }
  if (event.type === 'cost_update' && typeof event.data.outputTokens === 'number') {
    run.tokenOutput += event.data.outputTokens as number
  }

  writeStore(store)
  return full
}
