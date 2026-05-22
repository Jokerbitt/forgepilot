import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { Delegation } from '@/lib/models/delegation'

// ── hoisted mocks ──────────────────────────────────────────────────────────────

const repoBatch = vi.hoisted(() => ({ delegations: [] as Delegation[] }))
const repoUpdate = vi.hoisted(() => vi.fn(() => Promise.resolve(null)))

vi.mock('@/lib/repositories/delegationRepository', () => ({
  SINGLE_TENANT_USER_ID: 'user-1',
  createDelegationRepository: vi.fn(() => ({
    listByStatus: vi.fn(() => Promise.resolve(repoBatch.delegations)),
    update: repoUpdate,
  })),
}))

vi.mock('@/lib/github/pr-status', () => ({
  fetchPRStatus: vi.fn(),
}))

vi.mock('@/lib/cron/auth', () => ({
  isCronAuthorized: vi.fn(() => true),
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { GET, POST } from './route'
import { fetchPRStatus } from '@/lib/github/pr-status'
import { isCronAuthorized } from '@/lib/cron/auth'

function makeRequest(): NextRequest {
  return new NextRequest('http://localhost/api/cron/pr-status-sync')
}

function makeDelegation(prUrl?: string, prState?: string): Delegation {
  return {
    id: 'del-1',
    title: 'Test',
    status: 'completed',
    executionRoute: 'runner',
    costEstimateUsd: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    summaryReport: prUrl ? {
      keyPoints: [],
      changes: [],
      timeTakenMinutes: 5,
      prUrl,
      prState: (prState as 'open' | 'merged' | 'closed') ?? 'open',
    } : undefined,
    contract: {
      id: 'c1', workItemId: 'JOK-1', goal: 'g', context: '',
      definitionOfDone: [], allowedTools: [], riskClass: 'A',
      branchStrategy: 'feature', maxBudgetUsd: 5, taskType: 'feature',
      requiresApproval: false, privacyMode: 'local' as const,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  }
}

describe('GET /api/cron/pr-status-sync', () => {
  beforeEach(() => {
    repoBatch.delegations = []
    repoUpdate.mockClear()
    vi.mocked(fetchPRStatus).mockClear()
    vi.mocked(isCronAuthorized).mockReturnValue(true)
  })

  it('returns 401 when not authorized', async () => {
    vi.mocked(isCronAuthorized).mockReturnValue(false)
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
  })

  it('returns ok with zero counts when no delegations have prUrl', async () => {
    repoBatch.delegations = [makeDelegation()]
    const res = await GET(makeRequest())
    const body = await res.json() as { checked: number; updated: number }
    expect(res.status).toBe(200)
    expect(body.checked).toBe(0)
    expect(body.updated).toBe(0)
  })

  it('skips delegations already marked merged', async () => {
    repoBatch.delegations = [makeDelegation('https://github.com/org/repo/pull/1', 'merged')]
    const res = await GET(makeRequest())
    const body = await res.json() as { checked: number }
    expect(body.checked).toBe(0)
    expect(fetchPRStatus).not.toHaveBeenCalled()
  })

  it('updates delegation when PR state changes to merged', async () => {
    repoBatch.delegations = [makeDelegation('https://github.com/org/repo/pull/1', 'open')]
    vi.mocked(fetchPRStatus).mockResolvedValue({
      prNumber: 1, owner: 'org', repo: 'repo',
      title: 'My PR', state: 'merged', ciState: 'success',
      ciChecks: [], headSha: 'abc123', updatedAt: '2026-01-02T00:00:00.000Z',
    })
    const res = await GET(makeRequest())
    const body = await res.json() as { updated: number; errors: number }
    expect(body.updated).toBe(1)
    expect(body.errors).toBe(0)
    expect(repoUpdate).toHaveBeenCalledWith('del-1', expect.objectContaining({
      summaryReport: expect.objectContaining({ prState: 'merged', prMergedAt: '2026-01-02T00:00:00.000Z' }),
    }))
  })

  it('does not update when PR state is unchanged', async () => {
    repoBatch.delegations = [makeDelegation('https://github.com/org/repo/pull/1', 'open')]
    vi.mocked(fetchPRStatus).mockResolvedValue({
      prNumber: 1, owner: 'org', repo: 'repo',
      title: 'My PR', state: 'open', ciState: 'pending',
      ciChecks: [], headSha: 'abc123', updatedAt: '2026-01-01T00:00:00.000Z',
    })
    const res = await GET(makeRequest())
    const body = await res.json() as { updated: number }
    expect(body.updated).toBe(0)
    expect(repoUpdate).not.toHaveBeenCalled()
  })

  it('counts fetch errors and still returns ok:false', async () => {
    repoBatch.delegations = [makeDelegation('https://github.com/org/repo/pull/1', 'open')]
    vi.mocked(fetchPRStatus).mockRejectedValue(new Error('network timeout'))
    const res = await GET(makeRequest())
    const body = await res.json() as { ok: boolean; errors: number }
    expect(body.errors).toBe(1)
    expect(body.ok).toBe(false)
  })

  it('POST delegates to GET', async () => {
    repoBatch.delegations = []
    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
  })
})
