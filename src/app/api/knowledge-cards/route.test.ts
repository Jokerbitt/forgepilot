/**
 * @vitest-environment node
 *
 * Tests for GET /api/knowledge-cards
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { KnowledgeCard } from '@/lib/knowledge/knowledge-card'

// ── Knowledge store mocks ──────────────────────────────────────────────────────

const readKnowledgeCards         = vi.fn<[], KnowledgeCard[]>()
const findKnowledgeCardsBySource = vi.fn<[string], KnowledgeCard[]>()

vi.mock('@/lib/knowledge/knowledge-card', () => ({
  readKnowledgeCards,
  findKnowledgeCardsBySource,
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
