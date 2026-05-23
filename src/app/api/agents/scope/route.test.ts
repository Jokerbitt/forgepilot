import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/agents/scope-lock', () => ({
  claimScope: vi.fn(),
  releaseScope: vi.fn(),
  getActiveClaims: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

const VALID_CLAIM_BODY = {
  agentId: 'claude-code-1',
  agentType: 'claude-code',
  milestone: 'M315',
  branch: 'feat/m315-test',
  filePatterns: ['src/app/api/agents/**'],
}

describe('GET /api/agents/scope', () => {
  it('returns active claims list', async () => {
    const { getActiveClaims } = await import('@/lib/agents/scope-lock')
    vi.mocked(getActiveClaims).mockReturnValue([
      {
        agentId: 'agent-1',
        agentType: 'claude-code' as const,
        milestone: 'M100',
        branch: 'feat/test',
        filePatterns: ['src/**'],
        claimedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60000).toISOString(),
      },
    ])

    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json() as { claims: unknown[]; count: number }

    expect(res.status).toBe(200)
    expect(body.count).toBe(1)
    expect(body.claims).toHaveLength(1)
  })

  it('returns empty claims when none active', async () => {
    const { getActiveClaims } = await import('@/lib/agents/scope-lock')
    vi.mocked(getActiveClaims).mockReturnValue([])

    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json() as { claims: unknown[]; count: number }

    expect(body.count).toBe(0)
    expect(body.claims).toHaveLength(0)
  })
})

describe('POST /api/agents/scope', () => {
  it('returns 200 and success when claim is granted', async () => {
    const { claimScope } = await import('@/lib/agents/scope-lock')
    vi.mocked(claimScope).mockReturnValue({ success: true, status: 'claimed' as const } as unknown as ReturnType<typeof claimScope>)

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/agents/scope', {
      method: 'POST',
      body: JSON.stringify(VALID_CLAIM_BODY),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    const body = await res.json() as { success: boolean }

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
  })

  it('returns 409 when scope is already claimed', async () => {
    const { claimScope } = await import('@/lib/agents/scope-lock')
    vi.mocked(claimScope).mockReturnValue({
      success: false,
      status: 'conflict' as const,
      conflict: { agentId: 'other-agent', milestone: 'M100', branch: 'feat/other' },
    } as unknown as ReturnType<typeof claimScope>)

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/agents/scope', {
      method: 'POST',
      body: JSON.stringify(VALID_CLAIM_BODY),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    const body = await res.json() as { success: boolean }

    expect(res.status).toBe(409)
    expect(body.success).toBe(false)
  })

  it('returns 422 when required fields are missing', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/agents/scope', {
      method: 'POST',
      body: JSON.stringify({ agentId: 'only-id' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})

describe('DELETE /api/agents/scope', () => {
  it('returns released: true when scope exists', async () => {
    const { releaseScope } = await import('@/lib/agents/scope-lock')
    vi.mocked(releaseScope).mockReturnValue(true)

    const { DELETE } = await import('./route')
    const req = new Request('http://localhost/api/agents/scope?agentId=claude-code-1')
    const res = await DELETE(req)
    const body = await res.json() as { released: boolean; agentId: string }

    expect(res.status).toBe(200)
    expect(body.released).toBe(true)
    expect(body.agentId).toBe('claude-code-1')
  })

  it('returns 400 when agentId is missing', async () => {
    const { DELETE } = await import('./route')
    const req = new Request('http://localhost/api/agents/scope')
    const res = await DELETE(req)
    expect(res.status).toBe(400)
  })
})
