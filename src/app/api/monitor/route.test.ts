import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/monitor/monitor-service', () => ({
  buildMonitorSnapshot: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/monitor', () => {
  it('returns monitor snapshot', async () => {
    const { buildMonitorSnapshot } = await import('@/lib/monitor/monitor-service')
    vi.mocked(buildMonitorSnapshot).mockReturnValue({
      timestamp: '2024-01-01T00:00:00.000Z',
      runningDelegations: 2,
      pendingApprovals: 1,
      failedRuns: 0,
    } as unknown as ReturnType<typeof buildMonitorSnapshot>)

    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json() as { runningDelegations: number; pendingApprovals: number }

    expect(res.status).toBe(200)
    expect(body.runningDelegations).toBe(2)
    expect(body.pendingApprovals).toBe(1)
  })
})
