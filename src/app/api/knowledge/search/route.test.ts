import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mock knowledge store ─────────────────────────────────────────────────────

const mockCards = vi.hoisted(() => [
  {
    id: 'card-001',
    type: 'learning' as const,
    title: 'JWT auth middleware implementation',
    body: 'Added JWT validation to all API routes. Uses jsonwebtoken library.',
    sourceIds: ['delegation-001'],
    tags: ['delegation:delegation-001', 'auto-extracted', 'skill:api-route'],
    privacyClass: 'internal' as const,
    confidence: 'high' as const,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'card-002',
    type: 'pattern' as const,
    title: 'Test pattern for Vitest',
    body: 'Use vi.mock() at the top of test files for module mocking.',
    sourceIds: ['delegation-002'],
    tags: ['delegation:delegation-002', 'skill:test'],
    privacyClass: 'internal' as const,
    confidence: 'medium' as const,
    createdAt: '2026-01-02T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z',
  },
  {
    id: 'card-003',
    type: 'risk' as const,
    title: 'Database migration risk',
    body: 'Always backup before running Drizzle migrations in production.',
    sourceIds: ['delegation-003'],
    tags: ['delegation:delegation-003', 'risk:B'],
    privacyClass: 'internal' as const,
    confidence: 'high' as const,
    createdAt: '2026-01-03T00:00:00Z',
    updatedAt: '2026-01-03T00:00:00Z',
  },
])

vi.mock('@/lib/knowledge/store', () => ({
  getCards: vi.fn(() => mockCards),
  upsertCard: vi.fn(),
  deleteCard: vi.fn(),
  queryCards: vi.fn(),
}))

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/knowledge/search', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('returns all cards when no query given', async () => {
    const { GET } = await import('./route')
    const req = new Request('http://localhost/api/knowledge/search')
    const res = await GET(req)
    const data = await res.json() as { cards: unknown[]; total: number }

    expect(res.status).toBe(200)
    expect(data.total).toBe(3)
    expect(data.cards).toHaveLength(3)
  })

  it('respects limit parameter', async () => {
    const { GET } = await import('./route')
    const req = new Request('http://localhost/api/knowledge/search?limit=1')
    const res = await GET(req)
    const data = await res.json() as { cards: unknown[]; total: number }

    expect(data.cards).toHaveLength(1)
    expect(data.total).toBe(3)
  })

  it('filters by type parameter', async () => {
    const { GET } = await import('./route')
    const req = new Request('http://localhost/api/knowledge/search?type=pattern')
    const res = await GET(req)
    const data = await res.json() as { cards: Array<{ type: string }>; total: number }

    expect(data.cards.every(c => c.type === 'pattern')).toBe(true)
    expect(data.total).toBe(1)
  })

  it('returns matching cards for query q=jwt', async () => {
    const { GET } = await import('./route')
    const req = new Request('http://localhost/api/knowledge/search?q=jwt')
    const res = await GET(req)
    const data = await res.json() as { cards: Array<{ id: string }>; total: number }

    expect(data.total).toBeGreaterThan(0)
    expect(data.cards[0].id).toBe('card-001')
  })

  it('title match ranks higher than body match', async () => {
    const { GET } = await import('./route')
    // "jwt" is in card-001 title → higher rank than body-only matches
    const req = new Request('http://localhost/api/knowledge/search?q=jwt')
    const res = await GET(req)
    const data = await res.json() as { cards: Array<{ id: string }> }

    expect(data.cards[0].id).toBe('card-001')
  })

  it('returns empty cards array when no match found', async () => {
    const { GET } = await import('./route')
    const req = new Request('http://localhost/api/knowledge/search?q=xyznonexistent')
    const res = await GET(req)
    const data = await res.json() as { cards: unknown[]; total: number }

    expect(data.cards).toHaveLength(0)
    expect(data.total).toBe(0)
  })

  it('case-insensitive search', async () => {
    const { GET } = await import('./route')
    const req = new Request('http://localhost/api/knowledge/search?q=JWT')
    const res = await GET(req)
    const data = await res.json() as { cards: unknown[] }

    expect(data.cards.length).toBeGreaterThan(0)
  })

  it('combines type filter and query', async () => {
    const { GET } = await import('./route')
    const req = new Request('http://localhost/api/knowledge/search?q=test&type=pattern')
    const res = await GET(req)
    const data = await res.json() as { cards: Array<{ type: string; id: string }> }

    expect(data.cards.every(c => c.type === 'pattern')).toBe(true)
    expect(data.cards[0].id).toBe('card-002')
  })
})
