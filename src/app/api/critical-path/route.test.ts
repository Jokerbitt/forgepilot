import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/criticalPath', () => ({
  computeCriticalPath: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/critical-path', () => {
  it('returns critical path result', async () => {
    const { computeCriticalPath } = await import('@/lib/criticalPath')
    vi.mocked(computeCriticalPath).mockResolvedValue({
      issues: [{ id: 'JOK-1', title: 'Auth module', priority: 1, status: 'Todo', estimate: 3 }],
      totalEstimate: 3,
      longestChain: 1,
    })

    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json() as { issues: unknown[]; totalEstimate: number }

    expect(res.status).toBe(200)
    expect(body.issues).toHaveLength(1)
    expect(body.totalEstimate).toBe(3)
  })

  it('returns empty result when computeCriticalPath throws', async () => {
    const { computeCriticalPath } = await import('@/lib/criticalPath')
    vi.mocked(computeCriticalPath).mockRejectedValue(new Error('Linear API unavailable'))

    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json() as { issues: unknown[]; totalEstimate: number; longestChain: number }

    expect(res.status).toBe(200)
    expect(body.issues).toHaveLength(0)
    expect(body.totalEstimate).toBe(0)
    expect(body.longestChain).toBe(0)
  })
})
