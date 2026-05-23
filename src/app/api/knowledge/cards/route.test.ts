import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/knowledge/store', () => ({
  getCards: vi.fn(),
  upsertCard: vi.fn(),
  deleteCard: vi.fn(),
  queryCards: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/knowledge/cards', () => {
  it('returns all cards', async () => {
    const { getCards } = await import('@/lib/knowledge/store')
    vi.mocked(getCards).mockReturnValue([
      { id: 'card-1', type: 'decision', title: 'Use Vitest', body: 'Better DX' },
    ] as ReturnType<typeof getCards>)

    const { GET } = await import('./route')
    const res = await GET(new Request('http://localhost/api/knowledge/cards'))
    const body = await res.json() as { id: string }[]

    expect(res.status).toBe(200)
    expect(body).toHaveLength(1)
    expect(body[0].id).toBe('card-1')
  })

  it('uses queryCards when tags filter is provided', async () => {
    const { queryCards } = await import('@/lib/knowledge/store')
    vi.mocked(queryCards).mockReturnValue([] as ReturnType<typeof queryCards>)

    const { GET } = await import('./route')
    await GET(new Request('http://localhost/api/knowledge/cards?tags=auth,testing'))

    expect(vi.mocked(queryCards)).toHaveBeenCalledWith(
      expect.objectContaining({ tags: ['auth', 'testing'] }),
    )
  })
})

describe('POST /api/knowledge/cards', () => {
  it('creates a card and returns 200', async () => {
    const { upsertCard } = await import('@/lib/knowledge/store')
    vi.mocked(upsertCard).mockReturnValue({ id: 'card-new', type: 'decision', title: 'New Card', body: 'Body' } as ReturnType<typeof upsertCard>)

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/knowledge/cards', {
      method: 'POST',
      body: JSON.stringify({ type: 'decision', title: 'New Card', body: 'Body text' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)

    expect(res.status).toBe(201)
  })

  it('returns 400 when required fields are missing', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/knowledge/cards', {
      method: 'POST',
      body: JSON.stringify({ title: 'No type or body' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
