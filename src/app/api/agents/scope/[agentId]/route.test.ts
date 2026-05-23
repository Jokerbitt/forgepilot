import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/agents/scope-lock', () => ({
  releaseScope: vi.fn(),
  isScopeLocked: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/agents/scope/[agentId]', () => {
  it('returns locked: true when claim exists', async () => {
    const { isScopeLocked } = await import('@/lib/agents/scope-lock')
    vi.mocked(isScopeLocked).mockReturnValue({
      agentId: 'claude-code-1',
      agentType: 'claude-code' as const,
      milestone: 'M315',
      branch: 'feat/m315',
      filePatterns: ['src/**'],
      claimedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60000).toISOString(),
    })

    const { GET } = await import('./route')
    const res = await GET(new Request('http://localhost'), { params: Promise.resolve({ agentId: 'claude-code-1' }) })
    const body = await res.json() as { locked: boolean; claim: unknown }

    expect(res.status).toBe(200)
    expect(body.locked).toBe(true)
    expect(body.claim).not.toBeNull()
  })

  it('returns locked: false when no claim', async () => {
    const { isScopeLocked } = await import('@/lib/agents/scope-lock')
    vi.mocked(isScopeLocked).mockReturnValue(null)

    const { GET } = await import('./route')
    const res = await GET(new Request('http://localhost'), { params: Promise.resolve({ agentId: 'ghost-agent' }) })
    const body = await res.json() as { locked: boolean; claim: unknown }

    expect(res.status).toBe(200)
    expect(body.locked).toBe(false)
    expect(body.claim).toBeNull()
  })
})

describe('DELETE /api/agents/scope/[agentId]', () => {
  it('returns released: true when scope existed', async () => {
    const { releaseScope } = await import('@/lib/agents/scope-lock')
    vi.mocked(releaseScope).mockReturnValue(true)

    const { DELETE } = await import('./route')
    const res = await DELETE(new Request('http://localhost'), { params: Promise.resolve({ agentId: 'claude-code-1' }) })
    const body = await res.json() as { released: boolean; agentId: string }

    expect(res.status).toBe(200)
    expect(body.released).toBe(true)
    expect(body.agentId).toBe('claude-code-1')
  })

  it('returns 404 when no scope to release', async () => {
    const { releaseScope } = await import('@/lib/agents/scope-lock')
    vi.mocked(releaseScope).mockReturnValue(false)

    const { DELETE } = await import('./route')
    const res = await DELETE(new Request('http://localhost'), { params: Promise.resolve({ agentId: 'ghost-agent' }) })
    expect(res.status).toBe(404)
  })
})
