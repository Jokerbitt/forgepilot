/**
 * @vitest-environment node
 *
 * Tests for POST /api/delegations/[id]/import-logs
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Delegation } from '@/lib/models/delegation'

// ── Repository mock ────────────────────────────────────────────────────────────

const repoFindById = vi.fn<(a: string) => Promise<Delegation | null>>()
const repoUpdate   = vi.fn<(a: string, b: Partial<Delegation>) => Promise<Delegation | null>>()

vi.mock('@/lib/repositories/delegationRepository', () => ({
  SINGLE_TENANT_USER_ID: 'user-1',
  createDelegationRepository: vi.fn(() => ({ findById: repoFindById, update: repoUpdate })),
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

function makeRequest(id: string, body: Record<string, unknown>) {
  const { NextRequest } = require('next/server') as typeof import('next/server')
  return new NextRequest(`http://localhost/api/delegations/${id}/import-logs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/delegations/[id]/import-logs', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 404 when delegation not found', async () => {
    repoFindById.mockResolvedValueOnce(null)
    const { POST } = await import('./route')
    const res = await POST(makeRequest('missing', { output: 'some log' }), makeParams('missing'))
    expect(res.status).toBe(404)
    expect(repoUpdate).not.toHaveBeenCalled()
  })

  it('returns 400 when output is missing', async () => {
    repoFindById.mockResolvedValueOnce(makeDelegation())
    const { POST } = await import('./route')
    const res = await POST(makeRequest('del-001', {}), makeParams('del-001'))
    expect(res.status).toBe(400)
    expect(repoUpdate).not.toHaveBeenCalled()
  })

  it('returns 400 when output is empty string', async () => {
    repoFindById.mockResolvedValueOnce(makeDelegation())
    const { POST } = await import('./route')
    const res = await POST(makeRequest('del-001', { output: '' }), makeParams('del-001'))
    expect(res.status).toBe(400)
  })

  it('imports logs and returns count', async () => {
    repoFindById.mockResolvedValueOnce(makeDelegation({ logs: [] }))
    repoUpdate.mockResolvedValueOnce(makeDelegation())
    const { POST } = await import('./route')
    const res = await POST(
      makeRequest('del-001', { output: 'line one\nline two\nline three' }),
      makeParams('del-001'),
    )
    expect(res.status).toBe(200)
    const body = await res.json() as { imported: number }
    expect(body.imported).toBe(3)
    expect(repoUpdate).toHaveBeenCalledOnce()
  })

  it('skips empty lines in output', async () => {
    repoFindById.mockResolvedValueOnce(makeDelegation({ logs: [] }))
    repoUpdate.mockResolvedValueOnce(makeDelegation())
    const { POST } = await import('./route')
    const res = await POST(
      makeRequest('del-001', { output: 'line one\n\n\nline two' }),
      makeParams('del-001'),
    )
    const body = await res.json() as { imported: number }
    expect(body.imported).toBe(2)
  })

  it('updates delegation status when status is provided', async () => {
    repoFindById.mockResolvedValueOnce(makeDelegation({ logs: [] }))
    repoUpdate.mockResolvedValueOnce(makeDelegation({ status: 'completed' }))
    const { POST } = await import('./route')
    await POST(
      makeRequest('del-001', { output: 'done', status: 'completed' }),
      makeParams('del-001'),
    )
    const updateArg = repoUpdate.mock.calls[0]?.[1] as { status?: string }
    expect(updateArg.status).toBe('completed')
  })

  it('classifies error lines as type error', async () => {
    repoFindById.mockResolvedValueOnce(makeDelegation({ logs: [] }))
    repoUpdate.mockResolvedValueOnce(makeDelegation())
    const { POST } = await import('./route')
    await POST(
      makeRequest('del-001', { output: 'Error: something failed' }),
      makeParams('del-001'),
    )
    const updateArg = repoUpdate.mock.calls[0]?.[1] as { logs: Array<{ type: string }> }
    expect(updateArg.logs?.at(-1)?.type).toBe('error')
  })

  it('classifies command lines as type command', async () => {
    repoFindById.mockResolvedValueOnce(makeDelegation({ logs: [] }))
    repoUpdate.mockResolvedValueOnce(makeDelegation())
    const { POST } = await import('./route')
    await POST(
      makeRequest('del-001', { output: '$ npm test' }),
      makeParams('del-001'),
    )
    const updateArg = repoUpdate.mock.calls[0]?.[1] as { logs: Array<{ type: string }> }
    expect(updateArg.logs?.at(-1)?.type).toBe('command')
  })
})
