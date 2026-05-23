import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/agent-runs/store', () => ({
  appendTraceEvent: vi.fn(),
  getRun: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/agent-runs/[id]/trace', () => {
  it('appends trace event and returns 201', async () => {
    const { appendTraceEvent } = await import('@/lib/agent-runs/store')
    vi.mocked(appendTraceEvent).mockReturnValue({
      id: 'ev-1', agentRunId: 'run-1', type: 'tool_call',
      timestamp: '2024-01-01T00:00:00.000Z', data: { tool: 'read' },
    } as unknown as ReturnType<typeof appendTraceEvent>)

    const { POST } = await import('./route')
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ type: 'tool_call', timestamp: '2024-01-01T00:00:00.000Z', data: { tool: 'read' } }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req, { params: Promise.resolve({ id: 'run-1' }) })
    const body = await res.json() as { id: string; type: string }

    expect(res.status).toBe(201)
    expect(body.type).toBe('tool_call')
  })

  it('returns 404 when run not found', async () => {
    const { appendTraceEvent } = await import('@/lib/agent-runs/store')
    vi.mocked(appendTraceEvent).mockReturnValue(null as unknown as ReturnType<typeof appendTraceEvent>)

    const { POST } = await import('./route')
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ type: 'tool_call', timestamp: '2024-01-01T00:00:00.000Z', data: {} }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req, { params: Promise.resolve({ id: 'missing' }) })
    expect(res.status).toBe(404)
  })

  it('returns 400 when required fields missing', async () => {
    const { POST } = await import('./route')
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ type: 'tool_call' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req, { params: Promise.resolve({ id: 'run-1' }) })
    expect(res.status).toBe(400)
  })
})

describe('GET /api/agent-runs/[id]/trace', () => {
  it('returns trace events for a run', async () => {
    const { getRun } = await import('@/lib/agent-runs/store')
    vi.mocked(getRun).mockReturnValue({ id: 'run-1', traceEvents: [{ id: 'ev-1', type: 'tool_call' }] } as unknown as ReturnType<typeof getRun>)

    const { GET } = await import('./route')
    const res = await GET(new Request('http://localhost'), { params: Promise.resolve({ id: 'run-1' }) })
    const body = await res.json() as { id: string }[]

    expect(res.status).toBe(200)
    expect(body).toHaveLength(1)
  })

  it('returns 404 when run not found', async () => {
    const { getRun } = await import('@/lib/agent-runs/store')
    vi.mocked(getRun).mockReturnValue(undefined as ReturnType<typeof getRun>)

    const { GET } = await import('./route')
    const res = await GET(new Request('http://localhost'), { params: Promise.resolve({ id: 'missing' }) })
    expect(res.status).toBe(404)
  })
})
