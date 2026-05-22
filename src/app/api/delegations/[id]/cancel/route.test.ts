/**
 * @vitest-environment node
 *
 * Tests for POST /api/delegations/[id]/cancel
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Delegation } from '@/lib/models/delegation'

// ── Repository mock ────────────────────────────────────────────────────────────

const repoFindById = vi.fn<[string], Promise<Delegation | null>>()
const repoUpdate   = vi.fn<[string, Partial<Delegation>], Promise<Delegation | null>>()

vi.mock('@/lib/repositories/delegationRepository', () => ({
  SINGLE_TENANT_USER_ID: 'user-1',
  createDelegationRepository: vi.fn(() => ({
    findById: repoFindById,
    update:   repoUpdate,
  })),
}))

// ── Process registry mock (kill is a no-op in tests) ──────────────────────────

vi.mock('@/lib/process-registry', () => ({
  killProcess: vi.fn(() => ({ killed: false, reason: 'No process registered' })),
}))

// ── Fixture ────────────────────────────────────────────────────────────────────

function makeDelegation(overrides: Partial<Delegation> = {}): Delegation {
  return {
    id: 'del-001',
    title: 'Test',
    status: 'running',
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

function makeRequest(id: string): Request {
  return new Request(`http://localhost/api/delegations/${id}/cancel`, { method: 'POST' })
}

function makeParams(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/delegations/[id]/cancel', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 404 when delegation not found', async () => {
    repoFindById.mockResolvedValueOnce(null)
    const { POST } = await import('./route')
    const res = await POST(makeRequest('nonexistent'), makeParams('nonexistent'))
    expect(res.status).toBe(404)
  })

  it('returns 400 when delegation is already completed', async () => {
    repoFindById.mockResolvedValueOnce(makeDelegation({ status: 'completed' }))
    const { POST } = await import('./route')
    const res = await POST(makeRequest('del-001'), makeParams('del-001'))
    expect(res.status).toBe(400)
    const body = await res.json() as { error: string }
    expect(body.error).toMatch(/completed/)
    expect(repoUpdate).not.toHaveBeenCalled()
  })

  it('returns 400 when delegation is already failed', async () => {
    repoFindById.mockResolvedValueOnce(makeDelegation({ status: 'failed' }))
    const { POST } = await import('./route')
    const res = await POST(makeRequest('del-001'), makeParams('del-001'))
    expect(res.status).toBe(400)
    expect(repoUpdate).not.toHaveBeenCalled()
  })

  it('cancels a running delegation and sets status to cancelled', async () => {
    const delegation = makeDelegation({ status: 'running' })
    repoFindById.mockResolvedValueOnce(delegation)
    repoUpdate.mockResolvedValueOnce({ ...delegation, status: 'cancelled' })
    const { POST } = await import('./route')
    const res = await POST(makeRequest('del-001'), makeParams('del-001'))
    expect(res.status).toBe(200)
    const body = await res.json() as { cancelled: boolean; delegationId: string }
    expect(body.cancelled).toBe(true)
    expect(body.delegationId).toBe('del-001')
    expect(repoUpdate).toHaveBeenCalledWith(
      'del-001',
      expect.objectContaining({ status: 'cancelled' }),
    )
  })

  it('cancels a pending delegation without trying to kill a process', async () => {
    const { killProcess } = await import('@/lib/process-registry')
    const delegation = makeDelegation({ status: 'pending' })
    repoFindById.mockResolvedValueOnce(delegation)
    repoUpdate.mockResolvedValueOnce({ ...delegation, status: 'cancelled' })
    const { POST } = await import('./route')
    const res = await POST(makeRequest('del-001'), makeParams('del-001'))
    expect(res.status).toBe(200)
    // killProcess should NOT be called for pending delegations
    expect(killProcess).not.toHaveBeenCalled()
    expect(repoUpdate).toHaveBeenCalledWith(
      'del-001',
      expect.objectContaining({ status: 'cancelled' }),
    )
  })
})
