import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/agent-runs/store', () => ({
  getRun: vi.fn(),
  updateRun: vi.fn(),
}))
vi.mock('@/lib/writeback/summary', () => ({
  buildRunSummary: vi.fn(),
}))
vi.mock('@/lib/writeback/lessons', () => ({
  writeRunLessons: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

const MOCK_RUN = {
  id: 'run-1',
  delegationId: 'del-1',
  status: 'running',
  createdAt: new Date().toISOString(),
}

describe('GET /api/agent-runs/[id]', () => {
  it('returns run when found', async () => {
    const { getRun } = await import('@/lib/agent-runs/store')
    vi.mocked(getRun).mockReturnValue(MOCK_RUN as ReturnType<typeof getRun>)

    const { GET } = await import('./route')
    const res = await GET(new Request('http://localhost'), { params: Promise.resolve({ id: 'run-1' }) })
    const body = await res.json() as typeof MOCK_RUN

    expect(res.status).toBe(200)
    expect(body.id).toBe('run-1')
  })

  it('returns 404 when run not found', async () => {
    const { getRun } = await import('@/lib/agent-runs/store')
    vi.mocked(getRun).mockReturnValue(undefined as ReturnType<typeof getRun>)

    const { GET } = await import('./route')
    const res = await GET(new Request('http://localhost'), { params: Promise.resolve({ id: 'unknown' }) })
    expect(res.status).toBe(404)
  })
})

describe('PATCH /api/agent-runs/[id]', () => {
  it('returns updated run', async () => {
    const { updateRun } = await import('@/lib/agent-runs/store')
    vi.mocked(updateRun).mockReturnValue({ ...MOCK_RUN, status: 'completed' } as ReturnType<typeof updateRun>)

    const { PATCH } = await import('./route')
    const req = new NextRequest('http://localhost', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'completed' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: 'run-1' }) })
    const body = await res.json() as { status: string }

    expect(res.status).toBe(200)
    expect(body.status).toBe('completed')
  })

  it('triggers writeRunLessons on completed status', async () => {
    const { updateRun } = await import('@/lib/agent-runs/store')
    const { writeRunLessons } = await import('@/lib/writeback/lessons')
    vi.mocked(updateRun).mockReturnValue({ ...MOCK_RUN, status: 'completed' } as ReturnType<typeof updateRun>)

    const { PATCH } = await import('./route')
    const req = new NextRequest('http://localhost', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'completed' }),
      headers: { 'Content-Type': 'application/json' },
    })
    await PATCH(req, { params: Promise.resolve({ id: 'run-1' }) })

    expect(vi.mocked(writeRunLessons)).toHaveBeenCalledOnce()
  })

  it('returns 404 when run not found', async () => {
    const { updateRun } = await import('@/lib/agent-runs/store')
    vi.mocked(updateRun).mockReturnValue(undefined as ReturnType<typeof updateRun>)

    const { PATCH } = await import('./route')
    const req = new NextRequest('http://localhost', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'running' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: 'unknown' }) })
    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/agent-runs/[id]', () => {
  it('returns run summary when found', async () => {
    const { getRun } = await import('@/lib/agent-runs/store')
    const { buildRunSummary } = await import('@/lib/writeback/summary')
    vi.mocked(getRun).mockReturnValue(MOCK_RUN as ReturnType<typeof getRun>)
    vi.mocked(buildRunSummary).mockReturnValue({ markdown: '# Summary', lessonProposal: null })

    const { DELETE } = await import('./route')
    const res = await DELETE(new Request('http://localhost'), { params: Promise.resolve({ id: 'run-1' }) })
    const body = await res.json() as { run: unknown; summary: string }

    expect(res.status).toBe(200)
    expect(body.summary).toBe('# Summary')
  })

  it('returns 404 when run not found', async () => {
    const { getRun } = await import('@/lib/agent-runs/store')
    vi.mocked(getRun).mockReturnValue(undefined as ReturnType<typeof getRun>)

    const { DELETE } = await import('./route')
    const res = await DELETE(new Request('http://localhost'), { params: Promise.resolve({ id: 'unknown' }) })
    expect(res.status).toBe(404)
  })
})
