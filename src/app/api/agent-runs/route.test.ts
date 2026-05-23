import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/agent-runs/store', () => ({
  createRun: vi.fn(),
  getRuns: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/agent-runs', () => {
  it('returns all runs when no filter provided', async () => {
    const { getRuns } = await import('@/lib/agent-runs/store')
    vi.mocked(getRuns).mockReturnValue([
      { id: 'run-1', delegationId: 'del-1', status: 'running' },
      { id: 'run-2', delegationId: 'del-2', status: 'completed' },
    ] as ReturnType<typeof getRuns>)

    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost/api/agent-runs')
    const res = await GET(req)
    const body = await res.json() as unknown[]

    expect(res.status).toBe(200)
    expect(body).toHaveLength(2)
    expect(vi.mocked(getRuns)).toHaveBeenCalledWith(undefined)
  })

  it('filters by delegationId when provided', async () => {
    const { getRuns } = await import('@/lib/agent-runs/store')
    vi.mocked(getRuns).mockReturnValue([
      { id: 'run-1', delegationId: 'del-1', status: 'running' },
    ] as ReturnType<typeof getRuns>)

    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost/api/agent-runs?delegationId=del-1')
    await GET(req)

    expect(vi.mocked(getRuns)).toHaveBeenCalledWith('del-1')
  })
})

describe('POST /api/agent-runs', () => {
  it('creates a new run and returns 201', async () => {
    const { createRun } = await import('@/lib/agent-runs/store')
    vi.mocked(createRun).mockReturnValue({
      id: 'run-3',
      delegationId: 'del-1',
      contractId: 'contract-1',
      status: 'pending',
    } as ReturnType<typeof createRun>)

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/agent-runs', {
      method: 'POST',
      body: JSON.stringify({ delegationId: 'del-1', contractId: 'contract-1', model: 'claude-opus-4-7' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    const body = await res.json() as { id: string; status: string }

    expect(res.status).toBe(201)
    expect(body.id).toBe('run-3')
    expect(body.status).toBe('pending')
  })

  it('returns 400 when required fields are missing', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/agent-runs', {
      method: 'POST',
      body: JSON.stringify({ model: 'claude-opus-4-7' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
