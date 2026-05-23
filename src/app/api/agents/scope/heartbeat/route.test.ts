import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/agents/scope-lock', () => ({
  heartbeatScope: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/agents/scope/heartbeat', () => {
  it('returns 200 when heartbeat renewed', async () => {
    const { heartbeatScope } = await import('@/lib/agents/scope-lock')
    vi.mocked(heartbeatScope).mockReturnValue(true)

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/agents/scope/heartbeat', {
      method: 'POST',
      body: JSON.stringify({ agentId: 'claude-code-1' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    const body = await res.json() as { renewed: boolean; agentId: string }

    expect(res.status).toBe(200)
    expect(body.renewed).toBe(true)
    expect(body.agentId).toBe('claude-code-1')
  })

  it('returns 404 when agent has no active scope', async () => {
    const { heartbeatScope } = await import('@/lib/agents/scope-lock')
    vi.mocked(heartbeatScope).mockReturnValue(false)

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/agents/scope/heartbeat', {
      method: 'POST',
      body: JSON.stringify({ agentId: 'unknown-agent' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    const body = await res.json() as { renewed: boolean }

    expect(res.status).toBe(404)
    expect(body.renewed).toBe(false)
  })

  it('returns 400 when agentId is missing', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/agents/scope/heartbeat', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
