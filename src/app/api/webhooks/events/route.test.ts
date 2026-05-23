import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/webhooks/event-log', () => ({
  getWebhookStats: vi.fn(),
  listWebhookEvents: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/webhooks/events', () => {
  it('returns all events and stats', async () => {
    const { getWebhookStats, listWebhookEvents } = await import('@/lib/webhooks/event-log')
    vi.mocked(getWebhookStats).mockReturnValue({ total: 10, bySource: {} } as ReturnType<typeof getWebhookStats>)
    vi.mocked(listWebhookEvents).mockReturnValue([
      { id: 'ev-1', source: 'linear', status: 'processed' },
      { id: 'ev-2', source: 'github', status: 'ignored' },
    ] as unknown as ReturnType<typeof listWebhookEvents>)

    const { GET } = await import('./route')
    const res = await GET(new NextRequest('http://localhost/api/webhooks/events'))
    const body = await res.json() as { stats: { total: number }; events: unknown[] }

    expect(res.status).toBe(200)
    expect(body.stats.total).toBe(10)
    expect(body.events).toHaveLength(2)
  })

  it('filters by source param', async () => {
    const { getWebhookStats, listWebhookEvents } = await import('@/lib/webhooks/event-log')
    vi.mocked(getWebhookStats).mockReturnValue({ total: 0, bySource: {} } as ReturnType<typeof getWebhookStats>)
    vi.mocked(listWebhookEvents).mockReturnValue([] as ReturnType<typeof listWebhookEvents>)

    const { GET } = await import('./route')
    await GET(new NextRequest('http://localhost/api/webhooks/events?source=linear'))

    expect(vi.mocked(listWebhookEvents)).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'linear' }),
    )
  })
})
