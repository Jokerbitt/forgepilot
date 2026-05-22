/**
 * @vitest-environment node
 *
 * Tests for POST /api/delegations/[id]/clone
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Delegation } from '@/lib/models/delegation'

// ── Repository mock ────────────────────────────────────────────────────────────

const repoFindById = vi.fn<[string], Promise<Delegation | null>>()
const repoCreate   = vi.fn<[unknown], Promise<Delegation>>()

vi.mock('@/lib/repositories/delegationRepository', () => ({
  SINGLE_TENANT_USER_ID: 'user-1',
  createDelegationRepository: vi.fn(() => ({
    findById: repoFindById,
    create:   repoCreate,
  })),
}))

// ── Fixture ────────────────────────────────────────────────────────────────────

function makeDelegation(overrides: Partial<Delegation> = {}): Delegation {
  return {
    id: 'del-001',
    title: 'Original',
    status: 'completed',
    executionRoute: 'local-agent',
    costEstimateUsd: 0.10,
    createdAt: '2026-05-01T10:00:00.000Z',
    updatedAt: '2026-05-01T11:00:00.000Z',
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

function makeRequest(id: string): Request {
  return new Request(`http://localhost/api/delegations/${id}/clone`, { method: 'POST' })
}

function makeParams(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/delegations/[id]/clone', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 404 when source delegation not found', async () => {
    repoFindById.mockResolvedValueOnce(null)
    const { POST } = await import('./route')
    const res = await POST(makeRequest('nonexistent'), makeParams('nonexistent'))
    expect(res.status).toBe(404)
    expect(repoCreate).not.toHaveBeenCalled()
  })

  it('returns 201 with new delegationId on success', async () => {
    const source = makeDelegation({ id: 'del-001' })
    const cloned = makeDelegation({ id: 'del-002', title: 'Original (Kopie)', status: 'pending' })
    repoFindById.mockResolvedValueOnce(source)
    repoCreate.mockResolvedValueOnce(cloned)
    const { POST } = await import('./route')
    const res = await POST(makeRequest('del-001'), makeParams('del-001'))
    expect(res.status).toBe(201)
    const body = await res.json() as { delegationId: string }
    expect(body.delegationId).toBe('del-002')
    expect(repoCreate).toHaveBeenCalledOnce()
  })

  it('clone is created with status pending regardless of source status', async () => {
    const source = makeDelegation({ id: 'del-001', status: 'failed' })
    const cloned = makeDelegation({ id: 'del-999', status: 'pending' })
    repoFindById.mockResolvedValueOnce(source)
    repoCreate.mockResolvedValueOnce(cloned)
    const { POST } = await import('./route')
    const res = await POST(makeRequest('del-001'), makeParams('del-001'))
    expect(res.status).toBe(201)
    // The input to repoCreate should have status: 'pending'
    const createArg = repoCreate.mock.calls[0]?.[0] as { status: string }
    expect(createArg.status).toBe('pending')
  })
})
