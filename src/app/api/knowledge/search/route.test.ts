import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { KnowledgeCard } from '@/lib/knowledge/knowledge-card'

// ─── Mock knowledge store (MemoryCards) ──────────────────────────────────────

const mockMemoryCards = vi.hoisted(() => [
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
  getCards: vi.fn(() => mockMemoryCards),
  upsertCard: vi.fn(),
  deleteCard: vi.fn(),
  queryCards: vi.fn(),
}))

// ─── Mock KnowledgeCards (delegation lessons) ─────────────────────────────────

const mockLessons = vi.hoisted((): KnowledgeCard[] => [
  {
    id: 'lesson-001',
    title: 'JWT secret must be rotated quarterly',
    content: 'Learned from delegation: rotate JWT secrets to prevent long-lived token attacks.',
    source: 'delegation',
    sourceId: 'del-999',
    tags: ['delegation', 'B'],
    createdAt: '2026-01-10T00:00:00Z',
    updatedAt: '2026-01-10T00:00:00Z',
  },
  {
    id: 'lesson-002',
    title: 'Docker compose healthcheck pattern',
    content: 'Use healthcheck with interval/timeout to ensure containers are ready before dependents start.',
    source: 'delegation',
    sourceId: 'del-888',
    tags: ['delegation', 'docker'],
    createdAt: '2026-01-05T00:00:00Z',
    updatedAt: '2026-01-05T00:00:00Z',
  },
])

vi.mock('@/lib/knowledge/knowledge-card', () => ({
  readKnowledgeCards: vi.fn(() => mockLessons),
}))

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/knowledge/search', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('returns all cards when no query given (legacy cards field)', async () => {
    const { GET } = await import('./route')
    const req = new Request('http://localhost/api/knowledge/search')
    const res = await GET(req)
    const data = await res.json() as { cards: unknown[]; total: number; results: unknown[] }

    expect(res.status).toBe(200)
    // total includes both memory cards (3) and lessons (2)
    expect(data.total).toBe(5)
    // legacy cards field only has memory-source results
    expect(data.cards).toHaveLength(3)
    // results includes both
    expect(data.results).toHaveLength(5)
  })

  it('respects limit parameter across combined results', async () => {
    const { GET } = await import('./route')
    const req = new Request('http://localhost/api/knowledge/search?limit=2')
    const res = await GET(req)
    const data = await res.json() as { results: unknown[]; total: number }

    expect(data.results).toHaveLength(2)
    expect(data.total).toBe(5)
  })

  it('filters by type=pattern returns only pattern MemoryCards', async () => {
    const { GET } = await import('./route')
    const req = new Request('http://localhost/api/knowledge/search?type=pattern')
    const res = await GET(req)
    const data = await res.json() as { results: Array<{ type: string }>; total: number }

    // pattern is a memory-only type, lessons excluded
    expect(data.results.every(r => r.type === 'pattern')).toBe(true)
    expect(data.total).toBe(1)
  })

  it('returns matching cards for query q=jwt including lessons', async () => {
    const { GET } = await import('./route')
    const req = new Request('http://localhost/api/knowledge/search?q=jwt')
    const res = await GET(req)
    const data = await res.json() as { results: Array<{ id: string; source: string }>; total: number }

    expect(data.total).toBeGreaterThanOrEqual(2) // memory card-001 + lesson-001
    const ids = data.results.map(r => r.id)
    expect(ids).toContain('card-001')
    expect(ids).toContain('lesson-001')
  })

  it('title match ranks higher than body match', async () => {
    const { GET } = await import('./route')
    // Use a term that only appears in card-001 title (not lesson titles)
    const req = new Request('http://localhost/api/knowledge/search?q=middleware')
    const res = await GET(req)
    const data = await res.json() as { results: Array<{ id: string }> }

    // "middleware" is in card-001 title → top result
    expect(data.results[0].id).toBe('card-001')
  })

  it('returns empty results when no match found', async () => {
    const { GET } = await import('./route')
    const req = new Request('http://localhost/api/knowledge/search?q=xyznonexistent')
    const res = await GET(req)
    const data = await res.json() as { results: unknown[]; total: number }

    expect(data.results).toHaveLength(0)
    expect(data.total).toBe(0)
  })

  it('case-insensitive search', async () => {
    const { GET } = await import('./route')
    const req = new Request('http://localhost/api/knowledge/search?q=JWT')
    const res = await GET(req)
    const data = await res.json() as { results: unknown[] }

    expect(data.results.length).toBeGreaterThan(0)
  })

  it('store=memory only returns MemoryCards', async () => {
    const { GET } = await import('./route')
    const req = new Request('http://localhost/api/knowledge/search?store=memory')
    const res = await GET(req)
    const data = await res.json() as { results: Array<{ source: string }>; total: number }

    expect(data.results.every(r => r.source === 'memory')).toBe(true)
    expect(data.total).toBe(3)
  })

  it('store=lesson only returns KnowledgeCards', async () => {
    const { GET } = await import('./route')
    const req = new Request('http://localhost/api/knowledge/search?store=lesson')
    const res = await GET(req)
    const data = await res.json() as { results: Array<{ source: string }>; total: number }

    expect(data.results.every(r => r.source === 'lesson')).toBe(true)
    expect(data.total).toBe(2)
  })

  it('lesson results carry sourceId and type=learning', async () => {
    const { GET } = await import('./route')
    const req = new Request('http://localhost/api/knowledge/search?store=lesson&q=docker')
    const res = await GET(req)
    const data = await res.json() as { results: Array<{ source: string; type: string; sourceId?: string }> }

    expect(data.results[0].source).toBe('lesson')
    expect(data.results[0].type).toBe('learning')
    expect(data.results[0].sourceId).toBe('del-888')
  })

  it('combines type filter and query (pattern + test)', async () => {
    const { GET } = await import('./route')
    const req = new Request('http://localhost/api/knowledge/search?q=test&type=pattern')
    const res = await GET(req)
    const data = await res.json() as { results: Array<{ type: string; id: string }> }

    expect(data.results.every(c => c.type === 'pattern')).toBe(true)
    expect(data.results[0].id).toBe('card-002')
  })
})
