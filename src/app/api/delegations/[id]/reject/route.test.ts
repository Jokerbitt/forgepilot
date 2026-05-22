/**
 * @vitest-environment node
 *
 * Tests for POST /api/delegations/[id]/reject — M295
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Delegation } from '@/lib/models/delegation'

const findById = vi.fn<[string], Promise<Delegation | null>>()
const update   = vi.fn()

vi.mock('@/lib/repositories/delegationRepository', () => ({
  SINGLE_TENANT_USER_ID: 'user-1',
  createDelegationRepository: vi.fn(() => ({ findById, update })),
}))

vi.mock('@/lib/audit', () => ({ logAuditEvent: vi.fn() }))

function makePending(id = 'del-1'): Delegation {
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
      riskClass: 'A',
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

function makeRequest(id: string, body: object = {}) {
  return {
    request: new Request(`http://localhost/api/delegations/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    params: Promise.resolve({ id }),
  }
}

describe('POST /api/delegations/[id]/reject', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 404 when delegation not found', async () => {
    findById.mockResolvedValueOnce(null)
    const { POST } = await import('./route')
    const { request, params } = makeRequest('missing')
    const res = await POST(request, { params })
    expect(res.status).toBe(404)
  })

  it('returns 409 when delegation is not pending', async () => {
    const running = { ...makePending(), status: 'running' as const }
    findById.mockResolvedValueOnce(running)
    const { POST } = await import('./route')
    const { request, params } = makeRequest('del-1')
    const res = await POST(request, { params })
    expect(res.status).toBe(409)
    const data = await res.json() as { error: string }
    expect(data.error).toContain('running')
  })

  it('rejects a pending delegation and returns updated', async () => {
    const d = makePending()
    const rejected = { ...d, status: 'rejected' as const }
    findById.mockResolvedValueOnce(d)
    update.mockResolvedValueOnce(rejected)

    const { POST } = await import('./route')
    const { request, params } = makeRequest('del-1', { reason: 'Not needed', actor: 'sven' })
    const res = await POST(request, { params })
    expect(res.status).toBe(200)
    const data = await res.json() as { status: string }
    expect(data.status).toBe('rejected')
    expect(update).toHaveBeenCalledWith('del-1', expect.objectContaining({ status: 'rejected' }))
  })

  it('appends a log entry with the reason', async () => {
    const d = makePending()
    findById.mockResolvedValueOnce(d)
    update.mockResolvedValueOnce({ ...d, status: 'rejected' })

    const { POST } = await import('./route')
    const { request, params } = makeRequest('del-1', { reason: 'Out of scope' })
    await POST(request, { params })

    const updateCall = update.mock.calls[0][1] as { logs: Array<{ message: string }> }
    expect(updateCall.logs.at(-1)?.message).toContain('Out of scope')
  })

  it('works without a reason (defaults applied)', async () => {
    const d = makePending()
    findById.mockResolvedValueOnce(d)
    update.mockResolvedValueOnce({ ...d, status: 'rejected' })

    const { POST } = await import('./route')
    const { request, params } = makeRequest('del-1', {})
    const res = await POST(request, { params })
    expect(res.status).toBe(200)
  })

  it('fires audit event with delegation.rejected action', async () => {
    const { logAuditEvent } = await import('@/lib/audit')
    const d = makePending()
    findById.mockResolvedValueOnce(d)
    update.mockResolvedValueOnce({ ...d, status: 'rejected' })

    const { POST } = await import('./route')
    const { request, params } = makeRequest('del-1', { reason: 'test', actor: 'sven' })
    await POST(request, { params })

    expect(logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'delegation.rejected', actor: 'sven' }),
    )
  })
})
