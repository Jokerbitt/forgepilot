import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/webhooks/event-log', () => ({
  getWebhookEvent: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/webhooks/events/[id]', () => {
  it('returns a single webhook event by id', async () => {
    const { getWebhookEvent } = await import('@/lib/webhooks/event-log')
    vi.mocked(getWebhookEvent).mockReturnValue({ id: 'ev-42', source: 'linear', status: 'processed' } as ReturnType<typeof getWebhookEvent>)

    const { GET } = await import('./route')
    const res = await GET(new Request('http://localhost'), { params: Promise.resolve({ id: 'ev-42' }) })
    const body = await res.json() as { id: string; source: string }

    expect(res.status).toBe(200)
    expect(body.id).toBe('ev-42')
    expect(body.source).toBe('linear')
  })

  it('returns 404 when event not found', async () => {
    const { getWebhookEvent } = await import('@/lib/webhooks/event-log')
    vi.mocked(getWebhookEvent).mockReturnValue(undefined as unknown as ReturnType<typeof getWebhookEvent>)

    const { GET } = await import('./route')
    const res = await GET(new Request('http://localhost'), { params: Promise.resolve({ id: 'missing' }) })
    expect(res.status).toBe(404)
  })
})
