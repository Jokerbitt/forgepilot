import { describe, it, expect, vi } from 'vitest'
import { GET } from './route'
import type { SearchResult } from './route'

const mockRead = vi.fn()

vi.mock('@/lib/knowledge/research-store', () => ({
  readResearchDocuments: () => mockRead(),
}))

function makeReq(q?: string): Request {
  const url = q !== undefined
    ? `http://localhost/api/knowledge/research/search?q=${encodeURIComponent(q)}`
    : 'http://localhost/api/knowledge/research/search'
  return new Request(url)
}

const makeDoc = (overrides: Record<string, unknown> = {}) => ({
  id: 'doc-1',
  topic: 'Test Topic',
  status: 'completed' as const,
  abstract: undefined,
  keyFindings: [] as string[],
  sections: [] as Array<{ heading: string; content: string; citations: string[] }>,
  citations: [],
  tags: [] as string[],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ...overrides,
})

describe('GET /api/knowledge/research/search', () => {
  it('returns 400 if q parameter is missing', async () => {
    mockRead.mockReturnValue([])
    const res = await GET(makeReq() as Parameters<typeof GET>[0])
    expect(res.status).toBe(400)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('q parameter required')
  })

  it('returns 400 if q is shorter than 2 characters', async () => {
    mockRead.mockReturnValue([])
    const res = await GET(makeReq('a') as Parameters<typeof GET>[0])
    expect(res.status).toBe(400)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('q must be at least 2 characters')
  })

  it('returns empty array when document store is empty', async () => {
    mockRead.mockReturnValue([])
    const res = await GET(makeReq('machine learning') as Parameters<typeof GET>[0])
    expect(res.status).toBe(200)
    const body = await res.json() as SearchResult[]
    expect(body).toHaveLength(0)
  })

  it('matches title and returns score 40 with highlight containing query', async () => {
    mockRead.mockReturnValue([
      makeDoc({ id: 'doc-1', topic: 'Machine Learning in Healthcare' }),
    ])
    const res = await GET(makeReq('Machine') as Parameters<typeof GET>[0])
    expect(res.status).toBe(200)
    const body = await res.json() as SearchResult[]
    expect(body).toHaveLength(1)
    expect(body[0].score).toBe(40)
    expect(body[0].title).toBe('Machine Learning in Healthcare')
    expect(body[0].highlights.length).toBeGreaterThan(0)
    expect(body[0].highlights[0].toLowerCase()).toContain('machine')
  })

  it('accumulates score additively for multiple field matches', async () => {
    // title (40) + abstract (25) + keyFindings (20) = 85
    mockRead.mockReturnValue([
      makeDoc({
        id: 'doc-1',
        topic: 'climate change effects',
        abstract: 'This study examines climate change impacts on ecosystems.',
        keyFindings: ['Climate change accelerates species extinction.'],
      }),
    ])
    const res = await GET(makeReq('climate') as Parameters<typeof GET>[0])
    expect(res.status).toBe(200)
    const body = await res.json() as SearchResult[]
    expect(body).toHaveLength(1)
    // title(40) + abstract(25) + keyFindings(20) = 85
    expect(body[0].score).toBe(85)
  })

  it('returns at most 20 results even when more documents match', async () => {
    const docs = Array.from({ length: 25 }, (_, i) =>
      makeDoc({ id: `doc-${i}`, topic: `Research document ${i} about quantum computing` })
    )
    mockRead.mockReturnValue(docs)
    const res = await GET(makeReq('quantum') as Parameters<typeof GET>[0])
    expect(res.status).toBe(200)
    const body = await res.json() as SearchResult[]
    expect(body).toHaveLength(20)
  })
})
