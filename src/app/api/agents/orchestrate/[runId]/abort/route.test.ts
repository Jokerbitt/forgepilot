import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/agents/orchestrated-run', () => ({
  getRun: vi.fn(),
  updateRunStatus: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/agents/orchestrate/[runId]/abort', () => {
  it('aborts a running run and returns aborted=true', async () => {
    const { getRun, updateRunStatus } = await import('@/lib/agents/orchestrated-run')
    vi.mocked(getRun).mockReturnValue({ id: 'run-1', status: 'running', tasks: [] } as ReturnType<typeof getRun>)
    vi.mocked(updateRunStatus).mockReturnValue(undefined)

    const { POST } = await import('./route')
    const res = await POST(new Request('http://localhost'), { params: Promise.resolve({ runId: 'run-1' }) })
    const body = await res.json() as { aborted: boolean; runId: string }

    expect(res.status).toBe(200)
    expect(body.aborted).toBe(true)
    expect(body.runId).toBe('run-1')
    expect(vi.mocked(updateRunStatus)).toHaveBeenCalledWith('run-1', 'aborted')
  })

  it('returns 404 when run is not found', async () => {
    const { getRun } = await import('@/lib/agents/orchestrated-run')
    vi.mocked(getRun).mockReturnValue(undefined as ReturnType<typeof getRun>)

    const { POST } = await import('./route')
    const res = await POST(new Request('http://localhost'), { params: Promise.resolve({ runId: 'missing' }) })
    expect(res.status).toBe(404)
  })

  it('returns 409 when run is already done', async () => {
    const { getRun } = await import('@/lib/agents/orchestrated-run')
    vi.mocked(getRun).mockReturnValue({ id: 'run-2', status: 'done', tasks: [] } as ReturnType<typeof getRun>)

    const { POST } = await import('./route')
    const res = await POST(new Request('http://localhost'), { params: Promise.resolve({ runId: 'run-2' }) })
    expect(res.status).toBe(409)
  })
})
