import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/agents/route-selector', () => ({
  selectBestRoute: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/delegations/suggest-route', () => {
  it('returns route suggestion for a goal', async () => {
    const { selectBestRoute } = await import('@/lib/agents/route-selector')
    vi.mocked(selectBestRoute).mockResolvedValue({
      route: 'local-agent',
      confidence: 0.85,
      reason: 'High local success rate',
    })

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/delegations/suggest-route', {
      method: 'POST',
      body: JSON.stringify({ goal: 'Refactor auth module' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    const body = await res.json() as { route: string; confidence: number }

    expect(res.status).toBe(200)
    expect(body.route).toBe('local-agent')
    expect(body.confidence).toBeGreaterThan(0)
  })

  it('returns 500 when route selector throws', async () => {
    const { selectBestRoute } = await import('@/lib/agents/route-selector')
    vi.mocked(selectBestRoute).mockRejectedValue(new Error('skill data unavailable'))

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/delegations/suggest-route', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    const body = await res.json() as { error: string }

    expect(res.status).toBe(500)
    expect(body.error).toBeTruthy()
  })
})
