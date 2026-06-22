/**
 * @vitest-environment node
 *
 * Tests for GET /api/knowledge-cards and POST /api/knowledge-cards
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { KnowledgeCard } from '@/lib/knowledge/knowledge-card'

// ── Knowledge store mocks ──────────────────────────────────────────────────────

const readKnowledgeCards         = vi.fn<() => KnowledgeCard[]>()
const findKnowledgeCardsBySource = vi.fn<(a: string) => KnowledgeCard[]>()
const writeKnowledgeCard         = vi.fn<(a: Omit<KnowledgeCard, 'id' | 'createdAt' | 'updatedAt'>) => KnowledgeCard>()

vi.mock('@/lib/knowledge/knowledge-card', () => ({
  readKnowledgeCards,
  findKnowledgeCardsBySource,
  writeKnowledgeCard,
}))

// ── Audit mock ─────────────────────────────────────────────────────────────────

vi.mock('@/lib/audit', () => ({
  logAuditEvent: vi.fn(),
}))

// ── Auth mock (disabled by default) ───────────────────────────────────────────

vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn().mockResolvedValue(null),
}))

// ── Fixture ────────────────────────────────────────────────────────────────────

function makeCard(overrides: Partial<KnowledgeCard> = {}): KnowledgeCard {
  return {
    id: 'kc-001',
    title: 'Test Card',
    content: 'Some content',
    source: 'delegation',
    sourceId: 'del-001',
    tags: [],
    createdAt: '2026-05-01T10:00:00.000Z',
    updatedAt: '2026-05-01T10:00:00.000Z',
    ...overrides,
  }
}

function makeRequest(url: string) {
  const { NextRequest } = require('next/server') as typeof import('next/server')
  return new NextRequest(url)
}

function makePostRequest(body: unknown) {
  const { NextRequest } = require('next/server') as typeof import('next/server')
  return new NextRequest('http://localhost/api/knowledge-cards', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/knowledge-cards', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns all cards sorted by createdAt descending', async () => {
    const cards = [
      makeCard({ id: 'kc-001', createdAt: '2026-05-01T10:00:00.000Z' }),
      makeCard({ id: 'kc-002', createdAt: '2026-05-02T10:00:00.000Z' }),
    ]
    readKnowledgeCards.mockReturnValueOnce(cards)
    const { GET } = await import('./route')
    const res = await GET(makeRequest('http://localhost/api/knowledge-cards'))
    expect(res.status).toBe(200)
    const body = await res.json() as { cards: KnowledgeCard[]; total: number }
    expect(body.total).toBe(2)
    // newer card first
    expect(body.cards[0].id).toBe('kc-002')
    expect(body.cards[1].id).toBe('kc-001')
  })

  it('filters by ?sourceId= using findKnowledgeCardsBySource', async () => {
    const cards = [makeCard({ sourceId: 'del-42' })]
    findKnowledgeCardsBySource.mockReturnValueOnce(cards)
    const { GET } = await import('./route')
    const res = await GET(makeRequest('http://localhost/api/knowledge-cards?sourceId=del-42'))
    expect(res.status).toBe(200)
    expect(findKnowledgeCardsBySource).toHaveBeenCalledWith('del-42')
    expect(readKnowledgeCards).not.toHaveBeenCalled()
  })

  it('returns empty array when no cards exist', async () => {
    readKnowledgeCards.mockReturnValueOnce([])
    const { GET } = await import('./route')
    const res = await GET(makeRequest('http://localhost/api/knowledge-cards'))
    const body = await res.json() as { total: number }
    expect(body.total).toBe(0)
  })
})

describe('POST /api/knowledge-cards', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 400 when title is missing', async () => {
    const { POST } = await import('./route')
    const res = await POST(makePostRequest({ content: 'some content', sourceId: 'del-001' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when content is missing', async () => {
    const { POST } = await import('./route')
    const res = await POST(makePostRequest({ title: 'Title', sourceId: 'del-001' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when sourceId is missing', async () => {
    const { POST } = await import('./route')
    const res = await POST(makePostRequest({ title: 'Title', content: 'Content' }))
    expect(res.status).toBe(400)
  })

  it('returns 201 with created card on valid input', async () => {
    const created = makeCard({ id: 'kc-new', title: 'New Card', content: 'Content', sourceId: 'del-001' })
    writeKnowledgeCard.mockReturnValueOnce(created)
    const { POST } = await import('./route')
    const res = await POST(makePostRequest({ title: 'New Card', content: 'Content', sourceId: 'del-001' }))
    expect(res.status).toBe(201)
    const body = await res.json() as KnowledgeCard
    expect(body.id).toBe('kc-new')
    expect(body.title).toBe('New Card')
  })

  it('passes sourceId, briefId, prUrl to writeKnowledgeCard', async () => {
    const created = makeCard({ sourceId: 'del-002', briefId: 'brief-7', prUrl: 'https://github.com/pr/1' })
    writeKnowledgeCard.mockReturnValueOnce(created)
    const { POST } = await import('./route')
    await POST(makePostRequest({
      title: 'T', content: 'C', sourceId: 'del-002', briefId: 'brief-7', prUrl: 'https://github.com/pr/1',
    }))
    expect(writeKnowledgeCard).toHaveBeenCalledWith(
      expect.objectContaining({ sourceId: 'del-002', briefId: 'brief-7', prUrl: 'https://github.com/pr/1' }),
    )
  })

  it('defaults tags to empty array when not provided', async () => {
    const created = makeCard({ tags: [] })
    writeKnowledgeCard.mockReturnValueOnce(created)
    const { POST } = await import('./route')
    await POST(makePostRequest({ title: 'T', content: 'C', sourceId: 'del-001' }))
    expect(writeKnowledgeCard).toHaveBeenCalledWith(expect.objectContaining({ tags: [] }))
  })

  it('passes provided tags to writeKnowledgeCard', async () => {
    const created = makeCard({ tags: ['typescript', 'api-route'] })
    writeKnowledgeCard.mockReturnValueOnce(created)
    const { POST } = await import('./route')
    await POST(makePostRequest({ title: 'T', content: 'C', sourceId: 'del-001', tags: ['typescript', 'api-route'] }))
    expect(writeKnowledgeCard).toHaveBeenCalledWith(
      expect.objectContaining({ tags: ['typescript', 'api-route'] }),
    )
  })

  it('returns 400 when tags array has more than 10 items', async () => {
    const { POST } = await import('./route')
    const tags = Array.from({ length: 11 }, (_, i) => `tag-${i}`)
    const res = await POST(makePostRequest({ title: 'T', content: 'C', sourceId: 'del-001', tags }))
    expect(res.status).toBe(400)
  })
})
