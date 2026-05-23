/**
 * @vitest-environment node
 *
 * Tests for GET /api/knowledge-cards/[id] and DELETE /api/knowledge-cards/[id]
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { KnowledgeCard } from '@/lib/knowledge/knowledge-card'

// ── Knowledge store mocks ──────────────────────────────────────────────────────

const findKnowledgeCardById  = vi.fn<[string], KnowledgeCard | undefined>()
const deleteKnowledgeCard    = vi.fn<[string], KnowledgeCard | undefined>()

vi.mock('@/lib/knowledge/knowledge-card', () => ({
  findKnowledgeCardById,
  deleteKnowledgeCard,
}))

// ── Auth + Audit mocks ─────────────────────────────────────────────────────────

vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/lib/audit', () => ({
  logAuditEvent: vi.fn(),
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

function makeRequest(url: string, method = 'GET') {
  const { NextRequest } = require('next/server') as typeof import('next/server')
  return new NextRequest(url, { method })
}

const PARAMS = { params: Promise.resolve({ id: 'kc-001' }) }

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/knowledge-cards/[id]', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 200 with the card when found', async () => {
    const card = makeCard()
    findKnowledgeCardById.mockReturnValueOnce(card)
    const { GET } = await import('./route')
    const res = await GET(makeRequest('http://localhost/api/knowledge-cards/kc-001'), PARAMS)
    expect(res.status).toBe(200)
    const body = await res.json() as KnowledgeCard
    expect(body.id).toBe('kc-001')
  })

  it('returns 404 when card does not exist', async () => {
    findKnowledgeCardById.mockReturnValueOnce(undefined)
    const { GET } = await import('./route')
    const res = await GET(makeRequest('http://localhost/api/knowledge-cards/ghost'), { params: Promise.resolve({ id: 'ghost' }) })
    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/knowledge-cards/[id]', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 200 with deleted id when card exists', async () => {
    const card = makeCard()
    deleteKnowledgeCard.mockReturnValueOnce(card)
    const { DELETE } = await import('./route')
    const res = await DELETE(makeRequest('http://localhost/api/knowledge-cards/kc-001', 'DELETE'), PARAMS)
    expect(res.status).toBe(200)
    const body = await res.json() as { success: boolean; deleted: string }
    expect(body.success).toBe(true)
    expect(body.deleted).toBe('kc-001')
  })

  it('returns 404 when card does not exist', async () => {
    deleteKnowledgeCard.mockReturnValueOnce(undefined)
    const { DELETE } = await import('./route')
    const res = await DELETE(makeRequest('http://localhost/api/knowledge-cards/ghost', 'DELETE'), { params: Promise.resolve({ id: 'ghost' }) })
    expect(res.status).toBe(404)
  })

  it('calls logAuditEvent with knowledge_card.deleted action', async () => {
    const { logAuditEvent } = await import('@/lib/audit')
    const card = makeCard({ id: 'kc-del', title: 'Deleted Card' })
    deleteKnowledgeCard.mockReturnValueOnce(card)
    const { DELETE } = await import('./route')
    await DELETE(makeRequest('http://localhost/api/knowledge-cards/kc-del', 'DELETE'), { params: Promise.resolve({ id: 'kc-del' }) })
    expect(logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'knowledge_card.deleted', entityId: 'kc-del' }),
    )
  })
})
