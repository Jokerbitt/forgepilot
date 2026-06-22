/**
 * @vitest-environment node
 *
 * Tests for GET and POST /api/attention
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AttentionItem } from '@/lib/models/attention'
import type { Delegation } from '@/lib/models/delegation'

// ── Attention store mock ───────────────────────────────────────────────────────

const getOpenAttentionItems = vi.fn<() => AttentionItem[]>()
const upsertAttentionItem   = vi.fn<(a: AttentionItem) => void>()

vi.mock('@/lib/attention/store', () => ({ getOpenAttentionItems, upsertAttentionItem }))

// ── Attention engine mock ──────────────────────────────────────────────────────

const syncAttentionFromDelegations = vi.fn<(a: Delegation[]) => void>()

vi.mock('@/lib/attention/engine', () => ({ syncAttentionFromDelegations }))

// ── Repository mock ────────────────────────────────────────────────────────────

const repoListByStatus = vi.fn<() => Promise<Delegation[]>>()

vi.mock('@/lib/repositories/delegationRepository', () => ({
  SINGLE_TENANT_USER_ID: 'user-1',
  createDelegationRepository: vi.fn(() => ({ listByStatus: repoListByStatus })),
}))

// ── Fixtures ───────────────────────────────────────────────────────────────────

function makeAttentionItem(overrides: Partial<AttentionItem> = {}): AttentionItem {
  return {
    id: 'att-001',
    type: 'delegation_completed',
    severity: 'info',
    title: 'Test Item',
    body: 'Description',
    createdAt: '2026-05-01T10:00:00.000Z',
    ...overrides,
  }
}

function makePostRequest(body: Record<string, unknown>) {
  const { NextRequest } = require('next/server') as typeof import('next/server')
  return new NextRequest('http://localhost/api/attention', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/attention', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('syncs from delegations and returns open items', async () => {
    const items = [makeAttentionItem({ id: 'att-001' }), makeAttentionItem({ id: 'att-002' })]
    repoListByStatus.mockResolvedValueOnce([])
    getOpenAttentionItems.mockReturnValueOnce(items)
    const { GET } = await import('./route')
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json() as AttentionItem[]
    expect(body).toHaveLength(2)
    expect(syncAttentionFromDelegations).toHaveBeenCalledOnce()
  })

  it('returns empty array when no open items', async () => {
    repoListByStatus.mockResolvedValueOnce([])
    getOpenAttentionItems.mockReturnValueOnce([])
    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json() as AttentionItem[]
    expect(body).toHaveLength(0)
  })
})

describe('POST /api/attention', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('creates attention item and returns 201', async () => {
    const { POST } = await import('./route')
    const res = await POST(
      makePostRequest({
        type: 'escalation',
        severity: 'warning',
        title: 'Needs human input',
        body: 'Agent is blocked',
      }),
    )
    expect(res.status).toBe(201)
    const body = await res.json() as AttentionItem
    expect(body.type).toBe('escalation')
    expect(body.severity).toBe('warning')
    expect(body.title).toBe('Needs human input')
    expect(body.id).toBeTruthy()
    expect(upsertAttentionItem).toHaveBeenCalledOnce()
  })

  it('uses provided id when included in request', async () => {
    const { POST } = await import('./route')
    const res = await POST(
      makePostRequest({
        id: 'custom-id-123',
        type: 'system_error',
        severity: 'critical',
        title: 'Critical failure',
      }),
    )
    const body = await res.json() as AttentionItem
    expect(body.id).toBe('custom-id-123')
  })

  it('returns 400 when type is invalid', async () => {
    const { POST } = await import('./route')
    const res = await POST(
      makePostRequest({ type: 'not-a-valid-type', severity: 'info', title: 'Bad' }),
    )
    expect(res.status).toBe(400)
    expect(upsertAttentionItem).not.toHaveBeenCalled()
  })

  it('returns 400 when title is too short', async () => {
    const { POST } = await import('./route')
    const res = await POST(
      makePostRequest({ type: 'system_error', severity: 'info', title: 'Hi' }),
    )
    expect(res.status).toBe(400)
    expect(upsertAttentionItem).not.toHaveBeenCalled()
  })

  it('defaults severity to info when not provided', async () => {
    const { POST } = await import('./route')
    const res = await POST(
      makePostRequest({ type: 'review_passed', title: 'Code review passed' }),
    )
    expect(res.status).toBe(201)
    const body = await res.json() as AttentionItem
    expect(body.severity).toBe('info')
  })
})
