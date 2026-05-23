/**
 * @vitest-environment node
 *
 * Tests for GET/PATCH/DELETE /api/knowledge-cards/[id]
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { KnowledgeCard } from '@/lib/knowledge/knowledge-card'

// ── Knowledge store mocks ──────────────────────────────────────────────────────

const findKnowledgeCardById  = vi.fn<[string], KnowledgeCard | undefined>()
const deleteKnowledgeCard    = vi.fn<[string], KnowledgeCard | undefined>()
const updateKnowledgeCard    = vi.fn<[string, Partial<KnowledgeCard>], KnowledgeCard | undefined>()

vi.mock('@/lib/knowledge/knowledge-card', () => ({
  findKnowledgeCardById,
  deleteKnowledgeCard,
  updateKnowledgeCard,
}))

vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/lib/audit', () => ({
  logAuditEvent: vi.fn(),
}))

vi.mock('@/lib/validation/api', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/validation/api')>()
  return mod
})

// ── Fixture ────────────────────────────────────────────────────────────────────

function makeCard(overrides: Partial<KnowledgeCard> = {}): KnowledgeCard {
  return {
    id: 'kc-001', title: 'Test Card', content: 'Some content',
    source: 'delegation', sourceId: 'del-001', tags: [],
    createdAt: '2026-05-01T10:00:00.000Z', updatedAt: '2026-05-01T10:00:00.000Z',
    ...overrides,
  }
}

function makeRequest(url: string, method = 'GET', body?: unknown) {
  const { NextRequest } = require('next/server') as typeof import('next/server')
  return new NextRequest(url, {
    method,
    ...(body !== undefined && {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  })
}

const PARAMS = (id = 'kc-001') => ({ params: Promise.resolve({ id }) })

// ── GET ────────────────────────────────────────────────────────────────────────

describe('GET /api/knowledge-cards/[id]', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 200 with the card when found', async () => {
    findKnowledgeCardById.mockReturnValueOnce(makeCard())
    const { GET } = await import('./route')
    const res = await GET(makeRequest('http://localhost/api/knowledge-cards/kc-001'), PARAMS())
    expect(res.status).toBe(200)
    const body = await res.json() as KnowledgeCard
    expect(body.id).toBe('kc-001')
  })

  it('returns 404 when card does not exist', async () => {
    findKnowledgeCardById.mockReturnValueOnce(undefined)
    const { GET } = await import('./route')
    const res = await GET(makeRequest('http://localhost/api/knowledge-cards/ghost'), PARAMS('ghost'))
    expect(res.status).toBe(404)
  })
})

// ── PATCH ─────────────────────────────────────────────────────────────────────

describe('PATCH /api/knowledge-cards/[id]', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 200 with updated card', async () => {
    const updated = makeCard({ title: 'Updated Title' })
    findKnowledgeCardById.mockReturnValueOnce(makeCard())
    updateKnowledgeCard.mockReturnValueOnce(updated)
    const { PATCH } = await import('./route')
    const res = await PATCH(
      makeRequest('http://localhost/api/knowledge-cards/kc-001', 'PATCH', { title: 'Updated Title' }),
      PARAMS(),
    )
    expect(res.status).toBe(200)
    const body = await res.json() as KnowledgeCard
    expect(body.title).toBe('Updated Title')
  })

  it('returns 404 when card does not exist', async () => {
    findKnowledgeCardById.mockReturnValueOnce(undefined)
    const { PATCH } = await import('./route')
    const res = await PATCH(
      makeRequest('http://localhost/api/knowledge-cards/ghost', 'PATCH', { title: 'X' }),
      PARAMS('ghost'),
    )
    expect(res.status).toBe(404)
  })

  it('returns 400 when body is empty object', async () => {
    findKnowledgeCardById.mockReturnValueOnce(makeCard())
    const { PATCH } = await import('./route')
    const res = await PATCH(
      makeRequest('http://localhost/api/knowledge-cards/kc-001', 'PATCH', {}),
      PARAMS(),
    )
    expect(res.status).toBe(400)
  })

  it('passes patch fields to updateKnowledgeCard', async () => {
    const updated = makeCard({ tags: ['new-tag'] })
    findKnowledgeCardById.mockReturnValueOnce(makeCard())
    updateKnowledgeCard.mockReturnValueOnce(updated)
    const { PATCH } = await import('./route')
    await PATCH(
      makeRequest('http://localhost/api/knowledge-cards/kc-001', 'PATCH', { tags: ['new-tag'] }),
      PARAMS(),
    )
    expect(updateKnowledgeCard).toHaveBeenCalledWith('kc-001', expect.objectContaining({ tags: ['new-tag'] }))
  })

  it('fires logAuditEvent with knowledge_card.updated', async () => {
    const { logAuditEvent } = await import('@/lib/audit')
    const updated = makeCard({ id: 'kc-updated', title: 'Updated Title' })
    findKnowledgeCardById.mockReturnValueOnce(makeCard({ id: 'kc-updated' }))
    updateKnowledgeCard.mockReturnValueOnce(updated)
    const { PATCH } = await import('./route')
    await PATCH(
      makeRequest('http://localhost/api/knowledge-cards/kc-updated', 'PATCH', { title: 'Updated Title' }),
      PARAMS('kc-updated'),
    )
    expect(logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'knowledge_card.updated', entityId: 'kc-updated' }),
    )
  })
})

// ── DELETE ────────────────────────────────────────────────────────────────────

describe('DELETE /api/knowledge-cards/[id]', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 200 with deleted id when card exists', async () => {
    deleteKnowledgeCard.mockReturnValueOnce(makeCard())
    const { DELETE } = await import('./route')
    const res = await DELETE(makeRequest('http://localhost/api/knowledge-cards/kc-001', 'DELETE'), PARAMS())
    expect(res.status).toBe(200)
    const body = await res.json() as { success: boolean; deleted: string }
    expect(body.success).toBe(true)
    expect(body.deleted).toBe('kc-001')
  })

  it('returns 404 when card does not exist', async () => {
    deleteKnowledgeCard.mockReturnValueOnce(undefined)
    const { DELETE } = await import('./route')
    const res = await DELETE(makeRequest('http://localhost/api/knowledge-cards/ghost', 'DELETE'), PARAMS('ghost'))
    expect(res.status).toBe(404)
  })

  it('fires logAuditEvent with knowledge_card.deleted', async () => {
    const { logAuditEvent } = await import('@/lib/audit')
    deleteKnowledgeCard.mockReturnValueOnce(makeCard({ id: 'kc-del' }))
    const { DELETE } = await import('./route')
    await DELETE(makeRequest('http://localhost/api/knowledge-cards/kc-del', 'DELETE'), PARAMS('kc-del'))
    expect(logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'knowledge_card.deleted', entityId: 'kc-del' }),
    )
  })
})
