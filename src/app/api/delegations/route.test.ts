/**
 * @vitest-environment node
 *
 * Tests for GET / POST / PUT / DELETE /api/delegations
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Delegation } from '@/lib/models/delegation'

// ── Repository mock ────────────────────────────────────────────────────────────

const repoListByStatus = vi.fn<[Delegation['status'][]?], Promise<Delegation[]>>()
const repoFindById     = vi.fn<[string], Promise<Delegation | null>>()
const repoCreate       = vi.fn<[unknown], Promise<Delegation>>()
const repoUpdate       = vi.fn<[string, Partial<Delegation>], Promise<Delegation | null>>()
const repoDelete       = vi.fn<[string], Promise<boolean>>()

vi.mock('@/lib/repositories/delegationRepository', () => ({
  SINGLE_TENANT_USER_ID: 'user-1',
  createDelegationRepository: vi.fn(() => ({
    listByStatus: repoListByStatus,
    findById:     repoFindById,
    create:       repoCreate,
    update:       repoUpdate,
    delete:       repoDelete,
  })),
}))

// ── Watchdog mock (no-op in tests) ────────────────────────────────────────────

vi.mock('@/lib/delegations/watchdog', () => ({
  reapStaleDelegations: vi.fn(),
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
      goal: 'Test goal at least 5 chars',
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

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/delegations', () => {
  beforeEach(() => vi.clearAllMocks())

  function makeGetRequest(url: string) {
    const { NextRequest } = require('next/server') as typeof import('next/server')
    return new NextRequest(url)
  }

  it('returns list of delegations', async () => {
    const delegations = [makeDelegation({ id: 'del-001' }), makeDelegation({ id: 'del-002' })]
    repoListByStatus.mockResolvedValueOnce(delegations)
    const { GET } = await import('./route')
    const res = await GET(makeGetRequest('http://localhost/api/delegations'))
    expect(res.status).toBe(200)
    const body = await res.json() as Delegation[]
    expect(body).toHaveLength(2)
    expect(repoListByStatus).toHaveBeenCalledWith(undefined)
  })

  it('filters by ?statuses=running,pending', async () => {
    repoListByStatus.mockResolvedValueOnce([makeDelegation({ status: 'running' })])
    const { GET } = await import('./route')
    const res = await GET(makeGetRequest('http://localhost/api/delegations?statuses=running,pending'))
    expect(res.status).toBe(200)
    expect(repoListByStatus).toHaveBeenCalledWith(['running', 'pending'])
  })

  it('filters by ?briefId= and only returns matching delegations', async () => {
    const match    = makeDelegation({ id: 'del-001', briefId: 'brief-42' })
    const noMatch  = makeDelegation({ id: 'del-002', briefId: 'brief-99' })
    repoListByStatus.mockResolvedValueOnce([match, noMatch])
    const { GET } = await import('./route')
    const res = await GET(makeGetRequest('http://localhost/api/delegations?briefId=brief-42'))
    const body = await res.json() as Delegation[]
    expect(body).toHaveLength(1)
    expect(body[0].id).toBe('del-001')
  })

  it('limits results with ?limit=1', async () => {
    const delegations = [makeDelegation({ id: 'del-001' }), makeDelegation({ id: 'del-002' })]
    repoListByStatus.mockResolvedValueOnce(delegations)
    const { GET } = await import('./route')
    const res = await GET(makeGetRequest('http://localhost/api/delegations?limit=1'))
    const body = await res.json() as Delegation[]
    expect(body).toHaveLength(1)
  })

  it('backfills title from contract.goal when title is missing', async () => {
    const del = makeDelegation({ title: '' })
    del.contract.goal = 'Auto-generated title from goal'
    repoListByStatus.mockResolvedValueOnce([del])
    const { GET } = await import('./route')
    const res = await GET(makeGetRequest('http://localhost/api/delegations'))
    const body = await res.json() as Delegation[]
    expect(body[0].title).toBe('Auto-generated title from goal')
  })
})

describe('POST /api/delegations', () => {
  beforeEach(() => vi.clearAllMocks())

  function makePostRequest(body: unknown) {
    const { NextRequest } = require('next/server') as typeof import('next/server')
    return new NextRequest('http://localhost/api/delegations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  it('creates a new delegation and returns it', async () => {
    const created = makeDelegation({ id: 'del-new', status: 'approved' })
    repoListByStatus.mockResolvedValue([created])
    repoCreate.mockResolvedValueOnce(created)
    const { POST } = await import('./route')
    const res = await POST(makePostRequest({ contract: { goal: 'Valid goal here', riskClass: 'A' } }))
    expect(res.status).toBe(200)
    expect(repoCreate).toHaveBeenCalledOnce()
  })

  it('returns 400 when goal is too short', async () => {
    const { POST } = await import('./route')
    const res = await POST(makePostRequest({ contract: { goal: 'Hi' } }))
    expect(res.status).toBe(400)
    expect(repoCreate).not.toHaveBeenCalled()
  })

  it('updates existing delegation when id matches', async () => {
    const existing = makeDelegation({ id: 'del-001' })
    const updated  = makeDelegation({ id: 'del-001', status: 'running' })
    repoFindById.mockResolvedValueOnce(existing)
    repoUpdate.mockResolvedValueOnce(updated)
    repoListByStatus.mockResolvedValue([updated])
    const { POST } = await import('./route')
    const res = await POST(makePostRequest({ id: 'del-001', status: 'running', contract: { goal: 'Valid goal here', riskClass: 'A' } }))
    expect(res.status).toBe(200)
    expect(repoUpdate).toHaveBeenCalledOnce()
    expect(repoCreate).not.toHaveBeenCalled()
  })
})

describe('PUT /api/delegations (bulk update)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 400 when body is not an array', async () => {
    const { PUT } = await import('./route')
    const req = new Request('http://localhost/api/delegations', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'del-001' }),
    })
    const res = await PUT(req)
    expect(res.status).toBe(400)
    const body = await res.json() as { error: string }
    expect(body.error).toMatch(/array/)
    expect(repoUpdate).not.toHaveBeenCalled()
  })

  it('bulk-updates all delegations in the array', async () => {
    const del1 = makeDelegation({ id: 'del-001', status: 'completed' })
    const del2 = makeDelegation({ id: 'del-002', status: 'failed' })
    repoUpdate.mockResolvedValue(del1)
    const { PUT } = await import('./route')
    const req = new Request('http://localhost/api/delegations', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([del1, del2]),
    })
    const res = await PUT(req)
    expect(res.status).toBe(200)
    const body = await res.json() as { success: boolean; count: number }
    expect(body.success).toBe(true)
    expect(body.count).toBe(2)
    expect(repoUpdate).toHaveBeenCalledTimes(2)
    expect(repoUpdate).toHaveBeenCalledWith('del-001', del1)
    expect(repoUpdate).toHaveBeenCalledWith('del-002', del2)
  })

  it('returns count=0 for empty array', async () => {
    const { PUT } = await import('./route')
    const req = new Request('http://localhost/api/delegations', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([]),
    })
    const res = await PUT(req)
    expect(res.status).toBe(200)
    const body = await res.json() as { count: number }
    expect(body.count).toBe(0)
    expect(repoUpdate).not.toHaveBeenCalled()
  })
})

describe('DELETE /api/delegations', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes single delegation by ?id=', async () => {
    repoDelete.mockResolvedValueOnce(true)
    const { DELETE } = await import('./route')
    const req = new Request('http://localhost/api/delegations?id=del-001', { method: 'DELETE' })
    const res = await DELETE(req)
    expect(res.status).toBe(200)
    const body = await res.json() as { success: boolean; deleted: number }
    expect(body.success).toBe(true)
    expect(body.deleted).toBe(1)
    expect(repoDelete).toHaveBeenCalledWith('del-001')
  })

  it('returns 404 when id not found', async () => {
    repoDelete.mockResolvedValueOnce(false)
    const { DELETE } = await import('./route')
    const req = new Request('http://localhost/api/delegations?id=missing', { method: 'DELETE' })
    const res = await DELETE(req)
    expect(res.status).toBe(404)
  })

  it('bulk-deletes by ?statuses=completed,failed', async () => {
    const delegations = [
      makeDelegation({ id: 'del-001', status: 'completed' }),
      makeDelegation({ id: 'del-002', status: 'failed' }),
    ]
    repoListByStatus.mockResolvedValueOnce(delegations)
    repoDelete.mockResolvedValue(true)
    const { DELETE } = await import('./route')
    const req = new Request('http://localhost/api/delegations?statuses=completed,failed', { method: 'DELETE' })
    const res = await DELETE(req)
    expect(res.status).toBe(200)
    const body = await res.json() as { deleted: number }
    expect(body.deleted).toBe(2)
    expect(repoDelete).toHaveBeenCalledTimes(2)
  })

  it('returns 400 when neither id nor statuses provided', async () => {
    const { DELETE } = await import('./route')
    const req = new Request('http://localhost/api/delegations', { method: 'DELETE' })
    const res = await DELETE(req)
    expect(res.status).toBe(400)
  })
})
