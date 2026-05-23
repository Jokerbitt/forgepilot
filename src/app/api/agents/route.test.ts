import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/agents/registry', () => ({
  getAgents: vi.fn(),
  upsertAgent: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/agents', () => {
  it('returns all agents', async () => {
    const { getAgents } = await import('@/lib/agents/registry')
    vi.mocked(getAgents).mockReturnValue([
      { id: 'agent-1', role: 'executor', displayName: 'Claude Code' },
      { id: 'agent-2', role: 'planner', displayName: 'Codex' },
    ] as unknown as ReturnType<typeof getAgents>)

    const { GET } = await import('./route')
    const res = await GET(new Request('http://localhost/api/agents'))
    const body = await res.json() as unknown[]

    expect(res.status).toBe(200)
    expect(body).toHaveLength(2)
  })
})

describe('POST /api/agents', () => {
  it('creates agent and returns profile', async () => {
    const { upsertAgent } = await import('@/lib/agents/registry')
    vi.mocked(upsertAgent).mockReturnValue({
      id: 'agent-new',
      role: 'executor',
      displayName: 'New Agent',
    } as unknown as ReturnType<typeof upsertAgent>)

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/agents', {
      method: 'POST',
      body: JSON.stringify({ id: 'agent-new', role: 'executor', displayName: 'New Agent' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    const body = await res.json() as { id: string }

    expect(res.status).toBe(201)
    expect(body.id).toBe('agent-new')
  })

  it('returns 400 when required fields are missing', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/agents', {
      method: 'POST',
      body: JSON.stringify({ displayName: 'No ID or Role' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
