/**
 * @vitest-environment node
 *
 * Tests for GET /api/delegations/stats — verifies computation logic via a
 * mocked repository, not just the TypeScript interface shape.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Delegation } from '@/lib/models/delegation'
import type { DelegationStats } from './route'

// ── Repository mock ────────────────────────────────────────────────────────────

const repoListByStatus = vi.fn<() => Promise<Delegation[]>>()

vi.mock('@/lib/repositories/delegationRepository', () => ({
  SINGLE_TENANT_USER_ID: 'user-1',
  createDelegationRepository: vi.fn(() => ({
    listByStatus: repoListByStatus,
  })),
}))

// ── Fixture helpers ────────────────────────────────────────────────────────────

function today(): string {
  return new Date().toISOString()
}

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

function makeDelegation(overrides: Partial<Delegation> = {}): Delegation {
  return {
    id: 'del-001',
    title: 'Test',
    status: 'completed',
    executionRoute: 'local-agent',
    costEstimateUsd: 0.10,
    actualCostUsd: 0.05,
    createdAt: today(),
    updatedAt: today(),
    contract: {
      id: 'con-001',
      workItemId: 'FP-001',
      goal: 'Goal',
      context: 'Context',
      riskClass: 'A',
      maxBudgetUsd: 1.0,
      allowedTools: ['read'],
      branchStrategy: 'feature',
      requiresApproval: false,
      privacyMode: 'local',
      definitionOfDone: [],
      createdAt: today(),
    },
    ...overrides,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/delegations/stats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 200 with valid DelegationStats shape', async () => {
    repoListByStatus.mockResolvedValueOnce([])
    const { GET } = await import('./route')
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json() as DelegationStats
    expect(typeof body.total).toBe('number')
    expect(typeof body.running).toBe('number')
    expect(typeof body.pending).toBe('number')
    expect(typeof body.completed).toBe('number')
    expect(typeof body.failed).toBe('number')
    expect(typeof body.cancelled).toBe('number')
    expect(typeof body.totalEstimatedUsd).toBe('number')
    expect(typeof body.totalActualUsd).toBe('number')
    expect(typeof body.todayCount).toBe('number')
    expect(typeof body.todayActualUsd).toBe('number')
    expect(typeof body.prCreated).toBe('number')
    expect(typeof body.prMerged).toBe('number')
    expect(typeof body.prOpen).toBe('number')
  })

  it('correctly counts total and byStatus', async () => {
    repoListByStatus.mockResolvedValueOnce([
      makeDelegation({ id: 'd1', status: 'completed' }),
      makeDelegation({ id: 'd2', status: 'completed' }),
      makeDelegation({ id: 'd3', status: 'running' }),
      makeDelegation({ id: 'd4', status: 'pending' }),
      makeDelegation({ id: 'd5', status: 'failed' }),
    ])
    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json() as DelegationStats
    expect(body.total).toBe(5)
    expect(body.completed).toBe(2)
    expect(body.running).toBe(1)
    expect(body.pending).toBe(1)
    expect(body.failed).toBe(1)
    expect(body.byStatus['completed']).toBe(2)
  })

  it('sums cost estimates and actual costs', async () => {
    repoListByStatus.mockResolvedValueOnce([
      makeDelegation({ costEstimateUsd: 0.10, actualCostUsd: 0.08 }),
      makeDelegation({ costEstimateUsd: 0.20, actualCostUsd: 0.15 }),
      makeDelegation({ costEstimateUsd: 0.05, actualCostUsd: undefined }),
    ])
    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json() as DelegationStats
    expect(body.totalEstimatedUsd).toBeCloseTo(0.35)
    expect(body.totalActualUsd).toBeCloseTo(0.23)
  })

  it('counts todayCount and todayActualUsd for delegations created today', async () => {
    repoListByStatus.mockResolvedValueOnce([
      makeDelegation({ id: 'd1', createdAt: today(), actualCostUsd: 0.10 }),
      makeDelegation({ id: 'd2', createdAt: today(), actualCostUsd: 0.20 }),
      makeDelegation({ id: 'd3', createdAt: daysAgo(2), actualCostUsd: 0.50 }),
    ])
    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json() as DelegationStats
    expect(body.todayCount).toBe(2)
    expect(body.todayActualUsd).toBeCloseTo(0.30)
  })

  it('counts PR lifecycle metrics from summaryReport', async () => {
    const base = { keyPoints: [], changes: [], timeTakenMinutes: 1 }
    repoListByStatus.mockResolvedValueOnce([
      makeDelegation({ id: 'd1', summaryReport: { ...base, prUrl: 'https://github.com/org/repo/pull/1', prState: 'merged', prMergedAt: today() } }),
      makeDelegation({ id: 'd2', summaryReport: { ...base, prUrl: 'https://github.com/org/repo/pull/2', prState: 'open' } }),
      makeDelegation({ id: 'd3', summaryReport: { ...base, prUrl: 'https://github.com/org/repo/pull/3' } }),
      makeDelegation({ id: 'd4' }),
    ])
    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json() as DelegationStats
    expect(body.prCreated).toBe(3)
    expect(body.prMerged).toBe(1)
    expect(body.prOpen).toBe(2)
  })

  it('returns zero PR counts when no delegations have prUrl', async () => {
    repoListByStatus.mockResolvedValueOnce([
      makeDelegation({ id: 'd1' }),
      makeDelegation({ id: 'd2' }),
    ])
    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json() as DelegationStats
    expect(body.prCreated).toBe(0)
    expect(body.prMerged).toBe(0)
    expect(body.prOpen).toBe(0)
  })

  it('returns all zeros when repository is empty', async () => {
    repoListByStatus.mockResolvedValueOnce([])
    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json() as DelegationStats
    expect(body.total).toBe(0)
    expect(body.totalEstimatedUsd).toBe(0)
    expect(body.totalActualUsd).toBe(0)
    expect(body.todayCount).toBe(0)
    expect(body.prCreated).toBe(0)
  })
})

// ── Legacy shape tests (kept for TypeScript compile-time validation) ───────────

describe('DelegationStats shape', () => {
  it('has expected numeric fields', () => {
    const stats: DelegationStats = {
      total: 10,
      byStatus: { pending: 3, running: 1, completed: 6 },
      running: 1,
      pending: 3,
      approved: 0,
      completed: 6,
      failed: 0,
      cancelled: 0,
      totalEstimatedUsd: 5.50,
      totalActualUsd: 2.34,
      todayCount: 4,
      todayActualUsd: 1.10,
      prCreated: 3,
      prMerged: 2,
      prOpen: 1,
    }

    expect(stats.total).toBe(10)
    expect(stats.running + stats.pending + stats.completed).toBe(stats.total)
    expect(stats.totalEstimatedUsd).toBeGreaterThan(0)
    expect(stats.todayCount).toBeLessThanOrEqual(stats.total)
  })

  it('byStatus sum matches total', () => {
    const stats: DelegationStats = {
      total: 4,
      byStatus: { pending: 2, running: 1, failed: 1 },
      running: 1, pending: 2, approved: 0, completed: 0, failed: 1, cancelled: 0,
      totalEstimatedUsd: 0, totalActualUsd: 0, todayCount: 0, todayActualUsd: 0,
      prCreated: 0, prMerged: 0, prOpen: 0,
    }
    const sum = Object.values(stats.byStatus).reduce((a, b) => a + b, 0)
    expect(sum).toBe(stats.total)
  })
})
