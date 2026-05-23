import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/agents/orchestrated-run', () => ({
  reapStaleRuns: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/agents/orchestrate/watchdog', () => {
  it('reaps stale runs and returns count', async () => {
    const { reapStaleRuns } = await import('@/lib/agents/orchestrated-run')
    vi.mocked(reapStaleRuns).mockReturnValue(['run-old-1', 'run-old-2'] as unknown as ReturnType<typeof reapStaleRuns>)

    const { POST } = await import('./route')
    const res = await POST()
    const body = await res.json() as { reaped: string[]; count: number }

    expect(res.status).toBe(200)
    expect(body.count).toBe(2)
    expect(body.reaped).toContain('run-old-1')
  })

  it('returns count=0 when no stale runs', async () => {
    const { reapStaleRuns } = await import('@/lib/agents/orchestrated-run')
    vi.mocked(reapStaleRuns).mockReturnValue([] as ReturnType<typeof reapStaleRuns>)

    const { POST } = await import('./route')
    const res = await POST()
    const body = await res.json() as { count: number }

    expect(res.status).toBe(200)
    expect(body.count).toBe(0)
  })
})
