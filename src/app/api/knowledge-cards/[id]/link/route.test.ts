import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/knowledge/graph', () => ({
  linkCards: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/knowledge-cards/[id]/link', () => {
  it('links two cards and returns ok=true', async () => {
    const { linkCards } = await import('@/lib/knowledge/graph')
    vi.mocked(linkCards).mockResolvedValue({ success: true } as Awaited<ReturnType<typeof linkCards>>)

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/knowledge-cards/card-1/link', {
      method: 'POST',
      body: JSON.stringify({ targetId: 'card-2' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req, { params: Promise.resolve({ id: 'card-1' }) })
    const body = await res.json() as { ok: boolean }

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(vi.mocked(linkCards)).toHaveBeenCalledWith('card-1', 'card-2')
  })

  it('returns 400 when linkCards fails', async () => {
    const { linkCards } = await import('@/lib/knowledge/graph')
    vi.mocked(linkCards).mockResolvedValue({ success: false, reason: 'Card not found' } as Awaited<ReturnType<typeof linkCards>>)

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/knowledge-cards/card-x/link', {
      method: 'POST',
      body: JSON.stringify({ targetId: 'card-y' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req, { params: Promise.resolve({ id: 'card-x' }) })

    expect(res.status).toBe(400)
  })

  it('returns 400 when targetId is missing', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/knowledge-cards/card-1/link', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req, { params: Promise.resolve({ id: 'card-1' }) })
    expect(res.status).toBe(400)
  })
})
