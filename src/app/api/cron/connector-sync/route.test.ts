import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/cron/auth', () => ({
  isCronAuthorized: vi.fn(),
}))
vi.mock('@/lib/connectors/sync', () => ({
  syncAllConnectors: vi.fn(),
}))
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), child: vi.fn().mockReturnValue({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/cron/connector-sync', () => {
  it('returns 401 when not authorized', async () => {
    const { isCronAuthorized } = await import('@/lib/cron/auth')
    vi.mocked(isCronAuthorized).mockReturnValue(false)

    const { GET } = await import('./route')
    const res = await GET(new NextRequest('http://localhost/api/cron/connector-sync'))
    expect(res.status).toBe(401)
  })

  it('syncs connectors and returns summary', async () => {
    const { isCronAuthorized } = await import('@/lib/cron/auth')
    const { syncAllConnectors } = await import('@/lib/connectors/sync')

    vi.mocked(isCronAuthorized).mockReturnValue(true)
    vi.mocked(syncAllConnectors).mockResolvedValue({
      syncedAt: '2024-01-01T00:00:00.000Z',
      durationMs: 120,
      totalItems: 42,
      items: Array(42).fill({}),
      results: [{ connector: 'linear', ok: true, count: 42 }],
    } as unknown as Awaited<ReturnType<typeof syncAllConnectors>>)

    const { GET } = await import('./route')
    const res = await GET(new NextRequest('http://localhost/api/cron/connector-sync'))
    const body = await res.json() as { ok: boolean; totalItems: number }

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.totalItems).toBe(42)
  })

  it('returns 500 when sync throws', async () => {
    const { isCronAuthorized } = await import('@/lib/cron/auth')
    const { syncAllConnectors } = await import('@/lib/connectors/sync')

    vi.mocked(isCronAuthorized).mockReturnValue(true)
    vi.mocked(syncAllConnectors).mockRejectedValue(new Error('Linear API down'))

    const { GET } = await import('./route')
    const res = await GET(new NextRequest('http://localhost/api/cron/connector-sync'))
    expect(res.status).toBe(500)
  })
})
