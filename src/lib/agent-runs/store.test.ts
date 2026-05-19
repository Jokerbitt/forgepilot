import fs from 'fs'
import path from 'path'
import os from 'os'
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { createRun, getRun, getRuns, updateRun, appendTraceEvent } from './store'

const tmpFiles: string[] = []
let originalCwd: () => string

beforeEach(() => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forgepilot-agent-runs-'))
  const configDir = path.join(tmpDir, 'config')
  fs.mkdirSync(configDir)
  tmpFiles.push(tmpDir)

  originalCwd = process.cwd.bind(process)
  vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)
})

afterEach(() => {
  vi.restoreAllMocks()
  for (const f of tmpFiles.splice(0)) {
    fs.rmSync(f, { recursive: true, force: true })
  }
})

describe('createRun', () => {
  it('creates a run with queued status', () => {
    const run = createRun('del-1', 'con-1', 'claude-haiku')
    expect(run.status).toBe('queued')
    expect(run.delegationId).toBe('del-1')
    expect(run.model).toBe('claude-haiku')
    expect(run.id).toBeTruthy()
    expect(run.traceEvents).toHaveLength(0)
  })

  it('persists run to disk', () => {
    const run = createRun('del-1', 'con-1', 'claude-haiku')
    const found = getRun(run.id)
    expect(found?.id).toBe(run.id)
  })
})

describe('getRun', () => {
  it('returns undefined for unknown id', () => {
    expect(getRun('nonexistent')).toBeUndefined()
  })
})

describe('updateRun', () => {
  it('returns undefined for unknown id', () => {
    expect(updateRun('bad-id', { status: 'completed' })).toBeUndefined()
  })

  it('applies patch to existing run', () => {
    const run = createRun('del-3', 'con-3', 'claude-haiku')
    const updated = updateRun(run.id, { status: 'completed', resultSummary: 'Done.' })
    expect(updated?.status).toBe('completed')
    expect(updated?.resultSummary).toBe('Done.')
  })
})

describe('appendTraceEvent', () => {
  it('returns undefined for unknown run', () => {
    const event = appendTraceEvent('bad-run', {
      type: 'message',
      timestamp: new Date().toISOString(),
      data: { content: 'hello' },
    })
    expect(event).toBeUndefined()
  })

  it('appends event to run', () => {
    const run = createRun('del-4', 'con-4', 'claude-haiku')
    const event = appendTraceEvent(run.id, {
      type: 'tool_call',
      timestamp: new Date().toISOString(),
      data: { tool: 'Bash', input: 'ls' },
    })
    expect(event?.type).toBe('tool_call')
    expect(event?.agentRunId).toBe(run.id)
    expect(event?.id).toBeTruthy()
  })

  it('accumulates cost from cost_update events', () => {
    const run = createRun('del-5', 'con-5', 'claude-haiku')
    appendTraceEvent(run.id, {
      type: 'cost_update',
      timestamp: new Date().toISOString(),
      data: { inputTokens: 100, outputTokens: 50 },
      costUsd: 0.002,
    })
    const updated = getRun(run.id)
    expect(updated?.totalCostUsd).toBeCloseTo(0.002)
    expect(updated?.tokenInput).toBe(100)
    expect(updated?.tokenOutput).toBe(50)
  })
})

describe('getRuns', () => {
  it('filters by delegationId', () => {
    createRun('del-A', 'con-1', 'model')
    createRun('del-A', 'con-2', 'model')
    createRun('del-B', 'con-3', 'model')
    expect(getRuns('del-A')).toHaveLength(2)
    expect(getRuns('del-B')).toHaveLength(1)
  })
})
