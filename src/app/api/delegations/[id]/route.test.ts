/**
 * @vitest-environment node
 *
 * Tests for GET and PATCH /api/delegations/[id]
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Delegation } from '@/lib/models/delegation'

// ── Repository mock ────────────────────────────────────────────────────────────

const repoFindById = vi.fn<(a: string) => Promise<Delegation | null>>()
const repoUpdate   = vi.fn<(a: string, b: Partial<Delegation>) => Promise<Delegation | null>>()

vi.mock('@/lib/repositories/delegationRepository', () => ({
  SINGLE_TENANT_USER_ID: 'user-1',
  createDelegationRepository: vi.fn(() => ({
    findById: repoFindById,
    update:   repoUpdate,
  })),
}))

// ── Fixture ────────────────────────────────────────────────────────────────────

function makeDelegation(overrides: Partial<Delegation> = {}): Delegation {
  return {
    id: 'del-001',
    title: 'Test Delegation',
    status: 'pending',
    executionRoute: 'local-agent',
    costEstimateUsd: 0.10,
    createdAt: '2026-05-01T10:00:00.000Z',
    updatedAt: '2026-05-01T10:00:00.000Z',
    contract: {
      id: 'con-001',
      workItemId: 'FP-001',
      goal: 'Test goal',
      context: 'ctx',
      riskClass: 'A',
      maxBudgetUsd: 1.0,
      allowedTools: ['read'],
      branchStrategy: 'feature',
      requiresApproval: false,
      privacyMode: 'local',
      definitionOfDone: [],
      createdAt: '2026-05-01T10:00:00.000Z',
    },
    ...overrides,
  }
}

function makeGetRequest(id: string): Request {
  return new Request(`http://localhost/api/delegations/${id}`)
}

function makePatchRequest(id: string, body: Record<string, unknown>): Request {
  return new Request(`http://localhost/api/delegations/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeParams(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/delegations/[id]', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 200 with delegation when found', async () => {
    const delegation = makeDelegation({ id: 'del-001' })
    repoFindById.mockResolvedValueOnce(delegation)
    const { GET } = await import('./route')
    const res = await GET(makeGetRequest('del-001'), makeParams('del-001'))
    expect(res.status).toBe(200)
    const body = await res.json() as Delegation
    expect(body.id).toBe('del-001')
    expect(repoFindById).toHaveBeenCalledWith('del-001')
  })

  it('returns 404 when delegation not found', async () => {
    repoFindById.mockResolvedValueOnce(null)
    const { GET } = await import('./route')
    const res = await GET(makeGetRequest('nonexistent'), makeParams('nonexistent'))
    expect(res.status).toBe(404)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('Not found')
  })
})

describe('PATCH /api/delegations/[id]', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('updates status and returns 200', async () => {
    const updated = makeDelegation({ id: 'del-001', status: 'approved' })
    repoUpdate.mockResolvedValueOnce(updated)
    const { PATCH } = await import('./route')
    const res = await PATCH(
      makePatchRequest('del-001', { status: 'approved' }),
      makeParams('del-001'),
    )
    expect(res.status).toBe(200)
    const body = await res.json() as Delegation
    expect(body.status).toBe('approved')
    expect(repoUpdate).toHaveBeenCalledWith('del-001', expect.objectContaining({ status: 'approved' }))
  })

  it('updates priority and tags', async () => {
    const updated = makeDelegation({ id: 'del-001', priority: 3, tags: ['urgent'] })
    repoUpdate.mockResolvedValueOnce(updated)
    const { PATCH } = await import('./route')
    const res = await PATCH(
      makePatchRequest('del-001', { priority: 3, tags: ['urgent'] }),
      makeParams('del-001'),
    )
    expect(res.status).toBe(200)
    const body = await res.json() as Delegation
    expect(body.priority).toBe(3)
    expect(body.tags).toEqual(['urgent'])
  })

  it('returns 404 when delegation not found', async () => {
    repoUpdate.mockResolvedValueOnce(null)
    const { PATCH } = await import('./route')
    const res = await PATCH(
      makePatchRequest('missing', { status: 'approved' }),
      makeParams('missing'),
    )
    expect(res.status).toBe(404)
  })

  it('returns 400 for invalid status value', async () => {
    const { PATCH } = await import('./route')
    const res = await PATCH(
      makePatchRequest('del-001', { status: 'not-a-status' }),
      makeParams('del-001'),
    )
    expect(res.status).toBe(400)
    expect(repoUpdate).not.toHaveBeenCalled()
  })

  it('returns 400 for invalid priority (non-number)', async () => {
    const { PATCH } = await import('./route')
    const res = await PATCH(
      makePatchRequest('del-001', { priority: 'high' }),
      makeParams('del-001'),
    )
    expect(res.status).toBe(400)
    expect(repoUpdate).not.toHaveBeenCalled()
  })
})
