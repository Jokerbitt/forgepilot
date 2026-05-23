import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/knowledge/store', () => ({
  getSources: vi.fn(),
  upsertSource: vi.fn(),
  deleteSource: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/knowledge/sources', () => {
  it('returns all sources with isStale flag', async () => {
    const { getSources } = await import('@/lib/knowledge/store')
    vi.mocked(getSources).mockReturnValue([
      { id: 'src-1', type: 'markdown', name: 'ADR docs', path: '/docs', lastFetched: new Date().toISOString() },
    ] as ReturnType<typeof getSources>)

    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json() as { id: string; isStale: boolean }[]

    expect(res.status).toBe(200)
    expect(body).toHaveLength(1)
    expect(body[0].id).toBe('src-1')
    expect(typeof body[0].isStale).toBe('boolean')
  })
})

describe('POST /api/knowledge/sources', () => {
  it('creates a new source and returns 201', async () => {
    const { upsertSource } = await import('@/lib/knowledge/store')
    vi.mocked(upsertSource).mockReturnValue({ id: 'src-new', type: 'nas', name: 'NAS', path: '/Volumes/Sven', lastFetched: new Date().toISOString() } as ReturnType<typeof upsertSource>)

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/knowledge/sources', {
      method: 'POST',
      body: JSON.stringify({ type: 'nas', name: 'NAS docs', path: '/Volumes/Sven/docs' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)

    expect(res.status).toBe(201)
  })

  it('returns 400 when name is missing', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/knowledge/sources', {
      method: 'POST',
      body: JSON.stringify({ type: 'nas', path: '/Volumes/Sven' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
