/**
 * @vitest-environment node
 *
 * Tests for POST /api/delegations/[id]/resume-budget
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

// ── Auth mock (always authorized) ──────────────────────────────────────────────

vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(async () => null),
}))

// ── fetch mock (execute re-trigger is fire-and-forget) ─────────────────────────

const fetchMock = vi.fn(async () => new Response(null, { status: 200 }))
vi.stubGlobal('fetch', fetchMock)

// ── Fixture ────────────────────────────────────────────────────────────────────

function makeDelegation(overrides: Partial<Delegation> = {}): Delegation {
  return {
    id: 'del-001',
    title: 'Test',
    status: 'failed',
    executionRoute: 'local-agent',
    costEstimateUsd: 0.10,
    createdAt: '2026-05-01T10:00:00.000Z',
    updatedAt: '2026-05-01T10:00:00.000Z',
    budgetPaused: true,
    budgetPausedReason: 'Budget $4.00 erreicht',
    contract: {
      id: 'con-001',
      workItemId: 'FP-001',
      goal: 'Test goal',
      context: 'ctx',
      riskClass: 'A',
      maxBudgetUsd: 4.0,
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

function makeRequest(id: string, body?: unknown): Request {
  return new Request(`http://localhost/api/delegations/${id}/resume-budget`, {
    method: 'POST',
    ...(body !== undefined ? { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } } : {}),
  })
}

function makeParams(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/delegations/[id]/resume-budget', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 404 when delegation not found', async () => {
    repoFindById.mockResolvedValueOnce(null)
    const { POST } = await import('./route')
    const res = await POST(makeRequest('nope') as never, makeParams('nope'))
    expect(res.status).toBe(404)
    expect(repoUpdate).not.toHaveBeenCalled()
  })

  it('returns 409 when delegation is not budget-paused', async () => {
    repoFindById.mockResolvedValueOnce(makeDelegation({ budgetPaused: false }))
    const { POST } = await import('./route')
    const res = await POST(makeRequest('del-001') as never, makeParams('del-001'))
    expect(res.status).toBe(409)
    expect(repoUpdate).not.toHaveBeenCalled()
  })

  it('doubles the budget by default and re-approves', async () => {
    const delegation = makeDelegation()
    repoFindById.mockResolvedValueOnce(delegation)
    repoUpdate.mockResolvedValueOnce(delegation)
    const { POST } = await import('./route')
    const res = await POST(makeRequest('del-001') as never, makeParams('del-001'))
    expect(res.status).toBe(200)
    const body = await res.json() as { resumed: boolean; oldBudget: number; newBudget: number }
    expect(body.resumed).toBe(true)
    expect(body.oldBudget).toBe(4.0)
    expect(body.newBudget).toBe(8.0)
    expect(repoUpdate).toHaveBeenCalledWith('del-001', expect.objectContaining({
      status: 'approved',
      budgetPaused: false,
      contract: expect.objectContaining({ maxBudgetUsd: 8.0 }),
    }))
  })

  it('honours a custom multiplier within bounds', async () => {
    const delegation = makeDelegation()
    repoFindById.mockResolvedValueOnce(delegation)
    repoUpdate.mockResolvedValueOnce(delegation)
    const { POST } = await import('./route')
    const res = await POST(makeRequest('del-001', { multiplier: 3 }) as never, makeParams('del-001'))
    const body = await res.json() as { newBudget: number }
    expect(body.newBudget).toBe(12.0)
  })

  it('ignores an out-of-range multiplier and falls back to 2x', async () => {
    const delegation = makeDelegation()
    repoFindById.mockResolvedValueOnce(delegation)
    repoUpdate.mockResolvedValueOnce(delegation)
    const { POST } = await import('./route')
    const res = await POST(makeRequest('del-001', { multiplier: 99 }) as never, makeParams('del-001'))
    const body = await res.json() as { newBudget: number }
    expect(body.newBudget).toBe(8.0)
  })

  it('re-triggers the execute route', async () => {
    const delegation = makeDelegation()
    repoFindById.mockResolvedValueOnce(delegation)
    repoUpdate.mockResolvedValueOnce(delegation)
    const { POST } = await import('./route')
    await POST(makeRequest('del-001') as never, makeParams('del-001'))
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/delegations/del-001/execute'),
      expect.objectContaining({ method: 'POST' }),
    )
  })
})
