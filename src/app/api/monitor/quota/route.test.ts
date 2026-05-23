import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/quota/gemini-tracker', () => ({
  getGeminiQuota: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/monitor/quota', () => {
  it('returns Gemini quota information', async () => {
    const { getGeminiQuota } = await import('@/lib/quota/gemini-tracker')
    vi.mocked(getGeminiQuota).mockReturnValue({
      requestsToday: 42,
      limitPerDay: 1000,
      resetsAt: '2024-01-02T00:00:00.000Z',
    } as unknown as ReturnType<typeof getGeminiQuota>)

    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json() as { requestsToday: number; limitPerDay: number }

    expect(res.status).toBe(200)
    expect(body.requestsToday).toBe(42)
    expect(body.limitPerDay).toBe(1000)
  })
})
