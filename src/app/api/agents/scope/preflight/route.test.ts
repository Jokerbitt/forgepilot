import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/agents/scope-lock', () => ({
  preflight: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/agents/scope/preflight', () => {
  it('returns preflight result when scope is free', async () => {
    const { preflight } = await import('@/lib/agents/scope-lock')
    vi.mocked(preflight).mockReturnValue({ safe: true, conflicts: [] } as unknown as ReturnType<typeof preflight>)

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/agents/scope/preflight', {
      method: 'POST',
      body: JSON.stringify({ branch: 'feat/test', filePatterns: ['src/**'] }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    const body = await res.json() as { safe: boolean; conflicts: unknown[] }

    expect(res.status).toBe(200)
    expect(body.safe).toBe(true)
    expect(body.conflicts).toHaveLength(0)
  })

  it('returns safe: false when conflicts exist', async () => {
    const { preflight } = await import('@/lib/agents/scope-lock')
    vi.mocked(preflight).mockReturnValue({
      safe: false,
      conflicts: [{ agentId: 'other-agent', milestone: 'M100', branch: 'feat/test' }],
    } as unknown as ReturnType<typeof preflight>)

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/agents/scope/preflight', {
      method: 'POST',
      body: JSON.stringify({ branch: 'feat/test', filePatterns: ['src/**'] }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    const body = await res.json() as { safe: boolean; conflicts: unknown[] }

    expect(res.status).toBe(200)
    expect(body.safe).toBe(false)
    expect(body.conflicts).toHaveLength(1)
  })

  it('returns 400 when filePatterns is missing', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/agents/scope/preflight', {
      method: 'POST',
      body: JSON.stringify({ branch: 'feat/test' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
