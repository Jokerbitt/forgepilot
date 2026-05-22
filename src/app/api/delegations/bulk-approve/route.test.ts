/**
 * @vitest-environment node
 *
 * Tests for POST /api/delegations/bulk-approve — M292
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Delegation } from '@/lib/models/delegation'

// ── Repository mock ────────────────────────────────────────────────────────────

const findById = vi.fn<[string], Promise<Delegation | null>>()
const update   = vi.fn()

vi.mock('@/lib/repositories/delegationRepository', () => ({
  SINGLE_TENANT_USER_ID: 'user-1',
  createDelegationRepository: vi.fn(() => ({ findById, update })),
}))

vi.mock('@/lib/audit', () => ({ logAuditEvent: vi.fn().mockResolvedValue(undefined) }))

// ── Fixture ────────────────────────────────────────────────────────────────────

function makePending(id: string, riskClass: 'A' | 'B' | 'C' = 'A'): Delegation {
  return {
    id,
    title: `Delegation ${id}`,
    status: 'pending',
    executionRoute: 'local-agent',
    costEstimateUsd: 0.5,
    retryCount: 0,
    contract: {
      id: `c-${id}`,
      workItemId: 'W-1',
      goal: 'do something',
      context: '',
      definitionOfDone: [],
      allowedTools: [],
      branchStrategy: 'feature',
      riskClass,
      maxBudgetUsd: 1,
      requiresApproval: true,
      privacyMode: 'local',
      createdAt: new Date().toISOString(),
    },
    logs: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

function makeRequest(body: object) {
  return new Request('http://localhost/api/delegations/bulk-approve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/delegations/bulk-approve', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 400 when ids array is empty', async () => {
    const { POST } = await import('./route')
    const res = await POST(makeRequest({ ids: [] }))
    expect(res.status).toBe(400)
  })

  it('approves all qualifying pending delegations', async () => {
    const d1 = makePending('del-1')
    const d2 = makePending('del-2', 'B')
    findById
      .mockResolvedValueOnce(d1)
      .mockResolvedValueOnce(d2)
    update
      .mockResolvedValueOnce({ ...d1, status: 'approved' })
      .mockResolvedValueOnce({ ...d2, status: 'approved' })

    const { POST } = await import('./route')
    const res = await POST(makeRequest({ ids: ['del-1', 'del-2'] }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.count).toBe(2)
    expect(data.approved).toContain('del-1')
    expect(data.approved).toContain('del-2')
    expect(data.skipped).toHaveLength(0)
  })

  it('skips riskClass C delegations with reason', async () => {
    const classC = makePending('del-c', 'C')
    findById.mockResolvedValueOnce(classC)

    const { POST } = await import('./route')
    const res = await POST(makeRequest({ ids: ['del-c'] }))
    const data = await res.json()
    expect(data.count).toBe(0)
    expect(data.skipped[0].reason).toContain('riskClass C')
    expect(update).not.toHaveBeenCalled()
  })

  it('skips non-pending delegations', async () => {
    const running = { ...makePending('del-r'), status: 'running' as const }
    findById.mockResolvedValueOnce(running)

    const { POST } = await import('./route')
    const res = await POST(makeRequest({ ids: ['del-r'] }))
    const data = await res.json()
    expect(data.count).toBe(0)
    expect(data.skipped[0].reason).toContain('running')
  })

  it('skips not-found delegations', async () => {
    findById.mockResolvedValueOnce(null)

    const { POST } = await import('./route')
    const res = await POST(makeRequest({ ids: ['del-missing'] }))
    const data = await res.json()
    expect(data.count).toBe(0)
    expect(data.skipped[0].reason).toBe('not found')
  })

  it('handles mixed: some approved, some skipped', async () => {
    const good = makePending('del-good')
    const classC = makePending('del-bad', 'C')
    findById
      .mockResolvedValueOnce(good)
      .mockResolvedValueOnce(classC)
    update.mockResolvedValueOnce({ ...good, status: 'approved' })

    const { POST } = await import('./route')
    const res = await POST(makeRequest({ ids: ['del-good', 'del-bad'] }))
    const data = await res.json()
    expect(data.count).toBe(1)
    expect(data.approved).toContain('del-good')
    expect(data.skipped).toHaveLength(1)
  })
})
