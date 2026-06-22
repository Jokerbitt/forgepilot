/**
 * @vitest-environment node
 *
 * Tests for GET /api/delegations/analytics — M289
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Delegation } from '@/lib/models/delegation'

// ── Repository mock ────────────────────────────────────────────────────────────

const listByStatus = vi.fn<() => Promise<Delegation[]>>()

vi.mock('@/lib/repositories/delegationRepository', () => ({
  SINGLE_TENANT_USER_ID: 'user-1',
  createDelegationRepository: vi.fn(() => ({ listByStatus })),
}))

// ── Fixture ────────────────────────────────────────────────────────────────────

function makeD(overrides: Partial<Delegation> = {}): Delegation {
  return {
    id: 'del-1',
    title: 'Test',
    status: 'completed',
    executionRoute: 'local-agent',
    costEstimateUsd: 0.5,
    retryCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    contract: {
      id: 'c1',
      workItemId: 'W-1',
      goal: 'Do something',
      context: '',
      definitionOfDone: [],
      allowedTools: [],
      branchStrategy: 'feature' as const,
      riskClass: 'A',
      maxBudgetUsd: 1,
      requiresApproval: false,
      privacyMode: 'local',
      createdAt: new Date().toISOString(),
    },
    logs: [],
    ...overrides,
  }
}

function makeRequest(days?: number) {
  const url = days
    ? `http://localhost/api/delegations/analytics?days=${days}`
    : 'http://localhost/api/delegations/analytics'
  return new Request(url)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/delegations/analytics', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns analytics shape when no delegations exist', async () => {
    listByStatus.mockResolvedValueOnce([])
    const { GET } = await import('./route')
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveProperty('period')
    expect(data).toHaveProperty('costTrend')
    expect(data).toHaveProperty('byRiskClass')
    expect(data).toHaveProperty('criticRetryStats')
    expect(data).toHaveProperty('successRate')
    expect(data.successRate).toBe(0)
  })

  it('calculates success rate correctly', async () => {
    const delegations = [
      makeD({ id: 'd1', status: 'completed' }),
      makeD({ id: 'd2', status: 'completed' }),
      makeD({ id: 'd3', status: 'failed' }),
    ]
    listByStatus.mockResolvedValueOnce(delegations)
    const { GET } = await import('./route')
    const res = await GET(makeRequest())
    const data = await res.json()
    // 2 completed / 3 terminal = 67%
    expect(data.successRate).toBe(67)
  })

  it('breaks down delegations by risk class', async () => {
    const delegations = [
      makeD({ id: 'a1', status: 'completed', contract: { ...makeD().contract, riskClass: 'A' } }),
      makeD({ id: 'a2', status: 'failed',    contract: { ...makeD().contract, riskClass: 'A' } }),
      makeD({ id: 'b1', status: 'completed', contract: { ...makeD().contract, riskClass: 'B' } }),
    ]
    listByStatus.mockResolvedValueOnce(delegations)
    const { GET } = await import('./route')
    const res = await GET(makeRequest())
    const data = await res.json()
    expect(data.byRiskClass.A.total).toBe(2)
    expect(data.byRiskClass.A.successRate).toBe(50)
    expect(data.byRiskClass.B.total).toBe(1)
    expect(data.byRiskClass.B.successRate).toBe(100)
    expect(data.byRiskClass.C.total).toBe(0)
  })

  it('aggregates actual cost in total', async () => {
    const delegations = [
      makeD({ id: 'd1', actualCostUsd: 0.25 }),
      makeD({ id: 'd2', actualCostUsd: 0.50 }),
    ]
    listByStatus.mockResolvedValueOnce(delegations)
    const { GET } = await import('./route')
    const res = await GET(makeRequest())
    const data = await res.json()
    expect(data.totalCostUsd).toBe(0.75)
  })

  it('groups cost trend by day', async () => {
    const today = new Date().toISOString()
    const yesterday = new Date(Date.now() - 86400000).toISOString()
    const delegations = [
      makeD({ id: 'd1', createdAt: today }),
      makeD({ id: 'd2', createdAt: today }),
      makeD({ id: 'd3', createdAt: yesterday }),
    ]
    listByStatus.mockResolvedValueOnce(delegations)
    const { GET } = await import('./route')
    const res = await GET(makeRequest())
    const data = await res.json()
    expect(data.costTrend.length).toBeGreaterThanOrEqual(2)
    const todayBucket = data.costTrend.find((b: { count: number; date: string }) => b.date === today.slice(0, 10))
    expect(todayBucket?.count).toBe(2)
  })

  it('respects days query param (clamps to 7-90)', async () => {
    listByStatus.mockResolvedValueOnce([])
    const { GET } = await import('./route')
    const res = await GET(makeRequest(14))
    const data = await res.json()
    expect(data.period.days).toBe(14)
  })

  it('counts critic retry stats from chainedFromId', async () => {
    const original = makeD({ id: 'orig', status: 'failed' })
    const retry = makeD({ id: 'retry', chainedFromId: 'orig', status: 'completed', retryCount: 1 })
    listByStatus.mockResolvedValueOnce([original, retry])
    const { GET } = await import('./route')
    const res = await GET(makeRequest())
    const data = await res.json()
    expect(data.criticRetryStats.total).toBe(1)
    expect(data.criticRetryStats.successAfterRetry).toBe(1)
  })

  it('reports execution route breakdown', async () => {
    const delegations = [
      makeD({ id: 'd1', executionRoute: 'local-agent' }),
      makeD({ id: 'd2', executionRoute: 'local-agent' }),
      makeD({ id: 'd3', executionRoute: 'ollama-agent' }),
    ]
    listByStatus.mockResolvedValueOnce(delegations)
    const { GET } = await import('./route')
    const res = await GET(makeRequest())
    const data = await res.json()
    expect(data.executionRouteBreakdown['local-agent']).toBe(2)
    expect(data.executionRouteBreakdown['ollama-agent']).toBe(1)
  })
})
