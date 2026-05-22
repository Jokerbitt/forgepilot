/**
 * @vitest-environment node
 *
 * Tests for POST /api/delegations/[id]/escalate
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Delegation } from '@/lib/models/delegation'
import type { AttentionItem } from '@/lib/models/attention'

// ── Repository mock ────────────────────────────────────────────────────────────

const repoFindById = vi.fn<[string], Promise<Delegation | null>>()

vi.mock('@/lib/repositories/delegationRepository', () => ({
  SINGLE_TENANT_USER_ID: 'user-1',
  createDelegationRepository: vi.fn(() => ({ findById: repoFindById })),
}))

// ── Attention store mock ───────────────────────────────────────────────────────

const upsertAttentionItem = vi.fn<[AttentionItem], void>()

vi.mock('@/lib/attention/store', () => ({ upsertAttentionItem }))

// ── Fixture ────────────────────────────────────────────────────────────────────

function makeDelegation(overrides: Partial<Delegation> = {}): Delegation {
  return {
    id: 'del-001',
    title: 'My Task',
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

function makeRequest(id: string, body: Record<string, unknown>): Request {
  return new Request(`http://localhost/api/delegations/${id}/escalate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeParams(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/delegations/[id]/escalate', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 404 when delegation not found', async () => {
    repoFindById.mockResolvedValueOnce(null)
    const { POST } = await import('./route')
    const res = await POST(
      makeRequest('missing', { problem: 'help' }) as import('next/server').NextRequest,
      makeParams('missing'),
    )
    expect(res.status).toBe(404)
    expect(upsertAttentionItem).not.toHaveBeenCalled()
  })

  it('returns 400 when problem field is missing', async () => {
    repoFindById.mockResolvedValueOnce(makeDelegation())
    const { POST } = await import('./route')
    const res = await POST(
      makeRequest('del-001', {}) as import('next/server').NextRequest,
      makeParams('del-001'),
    )
    expect(res.status).toBe(400)
    expect(upsertAttentionItem).not.toHaveBeenCalled()
  })

  it('creates escalation AttentionItem and returns 200', async () => {
    repoFindById.mockResolvedValueOnce(makeDelegation({ id: 'del-001' }))
    const { POST } = await import('./route')
    const res = await POST(
      makeRequest('del-001', {
        problem: 'Blocked by missing config',
        options: ['Option A', 'Option B'],
        recommendation: 'Option A',
      }) as import('next/server').NextRequest,
      makeParams('del-001'),
    )
    expect(res.status).toBe(200)
    const body = await res.json() as { escalated: boolean }
    expect(body.escalated).toBe(true)
    expect(upsertAttentionItem).toHaveBeenCalledOnce()
    const item = upsertAttentionItem.mock.calls[0]?.[0]
    expect(item?.type).toBe('escalation')
    expect(item?.severity).toBe('warning')
    expect(item?.delegationId).toBe('del-001')
    expect(item?.escalationContext?.problem).toBe('Blocked by missing config')
    expect(item?.escalationContext?.recommendation).toBe('Option A')
  })

  it('escalation item title includes delegation title', async () => {
    repoFindById.mockResolvedValueOnce(makeDelegation({ id: 'del-001', title: 'My Task' }))
    const { POST } = await import('./route')
    await POST(
      makeRequest('del-001', { problem: 'issue' }) as import('next/server').NextRequest,
      makeParams('del-001'),
    )
    const item = upsertAttentionItem.mock.calls[0]?.[0]
    expect(item?.title).toContain('My Task')
  })
})
