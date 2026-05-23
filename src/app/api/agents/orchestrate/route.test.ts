import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/agents/ai-decomposer', () => ({
  decomposeWithAI: vi.fn(),
}))
vi.mock('@/lib/agents/orchestrated-run', () => ({
  createRun: vi.fn(),
  listRuns: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/agents/orchestrate', () => {
  it('returns all runs', async () => {
    const { listRuns } = await import('@/lib/agents/orchestrated-run')
    vi.mocked(listRuns).mockReturnValue([
      { id: 'run-1', delegationId: 'del-1', status: 'running' },
    ] as unknown as ReturnType<typeof listRuns>)

    const { GET } = await import('./route')
    const res = await GET(new Request('http://localhost/api/agents/orchestrate'))
    const body = await res.json() as { runs: unknown[]; count: number }

    expect(res.status).toBe(200)
    expect(body.count).toBe(1)
  })

  it('filters by delegationId', async () => {
    const { listRuns } = await import('@/lib/agents/orchestrated-run')
    vi.mocked(listRuns).mockReturnValue([])

    const { GET } = await import('./route')
    await GET(new Request('http://localhost/api/agents/orchestrate?delegationId=del-1'))

    expect(vi.mocked(listRuns)).toHaveBeenCalledWith('del-1')
  })
})

describe('POST /api/agents/orchestrate', () => {
  it('creates orchestrated run with decomposed tasks', async () => {
    const { decomposeWithAI } = await import('@/lib/agents/ai-decomposer')
    const { createRun } = await import('@/lib/agents/orchestrated-run')

    vi.mocked(decomposeWithAI).mockResolvedValue([
      { id: 'task-1', title: 'Write tests', status: 'pending' },
      { id: 'task-2', title: 'Review code', status: 'pending' },
    ] as unknown as Awaited<ReturnType<typeof decomposeWithAI>>)

    vi.mocked(createRun).mockReturnValue({
      id: 'orch-run-1',
      delegationId: 'del-1',
      status: 'pending',
    } as ReturnType<typeof createRun>)

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/agents/orchestrate', {
      method: 'POST',
      body: JSON.stringify({ delegationId: 'del-1', goal: 'Refactor module', delegationTitle: 'Refactor' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    const body = await res.json() as { run: unknown; taskCount: number }

    expect(res.status).toBe(201)
    expect(body.taskCount).toBe(2)
  })

  it('returns 400 when required fields missing', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/agents/orchestrate', {
      method: 'POST',
      body: JSON.stringify({ delegationTitle: 'No goal' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
