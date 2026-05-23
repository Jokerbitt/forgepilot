import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/agents/orchestrated-run', () => ({
  getRun: vi.fn(),
  reapStaleRuns: vi.fn(),
  updateTaskStatus: vi.fn(),
  updateRunStatus: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

const MOCK_RUN = { id: 'run-1', delegationId: 'del-1', status: 'running', tasks: [] }

describe('GET /api/agents/orchestrate/[runId]', () => {
  it('returns run when found', async () => {
    const { getRun } = await import('@/lib/agents/orchestrated-run')
    vi.mocked(getRun).mockReturnValue(MOCK_RUN as unknown as ReturnType<typeof getRun>)

    const { GET } = await import('./route')
    const res = await GET(new Request('http://localhost'), { params: Promise.resolve({ runId: 'run-1' }) })
    const body = await res.json() as { id: string }

    expect(res.status).toBe(200)
    expect(body.id).toBe('run-1')
  })

  it('returns 404 when run not found', async () => {
    const { getRun } = await import('@/lib/agents/orchestrated-run')
    vi.mocked(getRun).mockReturnValue(undefined as ReturnType<typeof getRun>)

    const { GET } = await import('./route')
    const res = await GET(new Request('http://localhost'), { params: Promise.resolve({ runId: 'unknown' }) })
    expect(res.status).toBe(404)
  })
})

describe('PATCH /api/agents/orchestrate/[runId]', () => {
  it('updates run status when runStatus provided', async () => {
    const { updateRunStatus } = await import('@/lib/agents/orchestrated-run')
    vi.mocked(updateRunStatus).mockReturnValue(undefined)

    const { PATCH } = await import('./route')
    const req = new NextRequest('http://localhost', {
      method: 'PATCH',
      body: JSON.stringify({ runStatus: 'completed' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PATCH(req, { params: Promise.resolve({ runId: 'run-1' }) })
    const body = await res.json() as { ok: boolean }

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
  })

  it('returns 400 when neither runStatus nor taskId/status provided', async () => {
    const { PATCH } = await import('./route')
    const req = new NextRequest('http://localhost', {
      method: 'PATCH',
      body: JSON.stringify({ result: 'some result' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PATCH(req, { params: Promise.resolve({ runId: 'run-1' }) })
    expect(res.status).toBe(400)
  })
})
