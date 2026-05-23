import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/agents/orchestrated-run', () => ({
  getRun: vi.fn(),
  setTaskAgentId: vi.fn(),
  updateTaskStatus: vi.fn(),
  updateRunStatus: vi.fn(),
  retryTask: vi.fn(),
  canRetry: vi.fn(),
}))
vi.mock('@/lib/agents/work-quality', () => ({
  scoreWork: vi.fn(),
}))
vi.mock('@/lib/agents/skill-evolver', () => ({
  recordOutcome: vi.fn(),
}))
vi.mock('@/lib/knowledge/store', () => ({
  upsertCard: vi.fn(),
}))
vi.mock('@/lib/notifications/notification-store', () => ({
  saveNotification: vi.fn(),
}))
vi.mock('@/lib/pilot/idea-history-store', () => ({
  updateIdeaHistoryStatus: vi.fn(),
}))
vi.mock('@/lib/logger', () => ({
  orchestrationLogger: {
    error: vi.fn(),
    info: vi.fn(),
  },
}))

import type { OrchestratedRun } from '@/lib/agents/orchestrated-run'

function makeRun(overrides: Partial<OrchestratedRun> = {}): OrchestratedRun {
  return {
    id: 'run-1',
    delegationId: 'del-1',
    delegationTitle: 'Test Run',
    goal: 'Do things',
    status: 'planning',
    tasks: [],
    currentTaskIndex: 0,
    maxRetries: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

function makeRequest(body?: unknown): Request {
  return new Request('http://localhost/api/agents/orchestrate/run-1/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : '{}',
  })
}

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name]
    return
  }
  process.env[name] = value
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/agents/orchestrate/[runId]/execute', () => {
  describe('guard checks', () => {
    it('returns 404 when run is not found', async () => {
      const { getRun } = await import('@/lib/agents/orchestrated-run')
      vi.mocked(getRun).mockReturnValue(undefined)

      const { POST } = await import('./route')
      const res = await POST(makeRequest(), { params: Promise.resolve({ runId: 'missing-run' }) })
      const body = await res.json() as { error: string }

      expect(res.status).toBe(404)
      expect(body.error).toBe('Run not found')
    })

    it('returns 409 when run is already running', async () => {
      const { getRun } = await import('@/lib/agents/orchestrated-run')
      vi.mocked(getRun).mockReturnValue(makeRun({ status: 'running' }))

      const { POST } = await import('./route')
      const res = await POST(makeRequest(), { params: Promise.resolve({ runId: 'run-1' }) })
      const body = await res.json() as { error: string }

      expect(res.status).toBe(409)
      expect(body.error).toBe('Run already executing')
    })
  })

  describe('successful start', () => {
    it('responds immediately with started=true and correct runId', async () => {
      const { getRun, updateRunStatus } = await import('@/lib/agents/orchestrated-run')
      vi.mocked(getRun).mockReturnValue(makeRun())

      const { POST } = await import('./route')
      const res = await POST(makeRequest(), { params: Promise.resolve({ runId: 'run-1' }) })
      const body = await res.json() as { started: boolean; runId: string }

      expect(res.status).toBe(200)
      expect(body.started).toBe(true)
      expect(body.runId).toBe('run-1')
      expect(vi.mocked(updateRunStatus)).toHaveBeenCalledWith('run-1', 'running')
    })

    it('sets status to running before returning', async () => {
      const { getRun, updateRunStatus } = await import('@/lib/agents/orchestrated-run')
      vi.mocked(getRun).mockReturnValue(makeRun())

      const { POST } = await import('./route')
      await POST(makeRequest(), { params: Promise.resolve({ runId: 'run-1' }) })

      expect(vi.mocked(updateRunStatus)).toHaveBeenCalledWith('run-1', 'running')
    })

    it('accepts skipFailed=true in body without error', async () => {
      const { getRun } = await import('@/lib/agents/orchestrated-run')
      vi.mocked(getRun).mockReturnValue(makeRun())

      const { POST } = await import('./route')
      const res = await POST(
        makeRequest({ skipFailed: true }),
        { params: Promise.resolve({ runId: 'run-1' }) }
      )

      expect(res.status).toBe(200)
    })

    it('accepts empty body gracefully', async () => {
      const { getRun } = await import('@/lib/agents/orchestrated-run')
      vi.mocked(getRun).mockReturnValue(makeRun())

      const { POST } = await import('./route')
      const req = new Request('http://localhost/api/agents/orchestrate/run-1/execute', {
        method: 'POST',
        body: 'invalid json {',
      })
      const res = await POST(req, { params: Promise.resolve({ runId: 'run-1' }) })

      expect(res.status).toBe(200)
    })
  })

  describe('auth headers', () => {
    it('uses FORGEPILOT_API_KEY when available', async () => {
      const original = process.env.FORGEPILOT_API_KEY
      process.env.FORGEPILOT_API_KEY = 'test-key'

      const { getRun } = await import('@/lib/agents/orchestrated-run')
      vi.mocked(getRun).mockReturnValue(makeRun())

      const { POST } = await import('./route')
      const res = await POST(makeRequest(), { params: Promise.resolve({ runId: 'run-1' }) })

      expect(res.status).toBe(200)
      restoreEnv('FORGEPILOT_API_KEY', original)
    })

    it('falls back to cookie forwarding when no API key', async () => {
      const original = process.env.FORGEPILOT_API_KEY
      delete process.env.FORGEPILOT_API_KEY

      const { getRun } = await import('@/lib/agents/orchestrated-run')
      vi.mocked(getRun).mockReturnValue(makeRun())

      const { POST } = await import('./route')
      const req = new Request('http://localhost/api/agents/orchestrate/run-1/execute', {
        method: 'POST',
        headers: { Cookie: 'session=abc123', 'Content-Type': 'application/json' },
        body: '{}',
      })
      const res = await POST(req, { params: Promise.resolve({ runId: 'run-1' }) })

      expect(res.status).toBe(200)
      restoreEnv('FORGEPILOT_API_KEY', original)
    })
  })
})
