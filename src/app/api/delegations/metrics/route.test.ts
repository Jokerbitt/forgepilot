/**
 * @vitest-environment node
 *
 * Tests for GET /api/delegations/metrics (M21.1)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Delegation } from '@/lib/models/delegation'

const mockListByStatus = vi.fn(async () => [] as Delegation[])

vi.mock('@/lib/repositories/delegationRepository', () => ({
  SINGLE_TENANT_USER_ID: 'user-1',
  createDelegationRepository: vi.fn(() => ({
    listByStatus: mockListByStatus,
  })),
}))

function makeD(overrides: Partial<Delegation> = {}): Delegation {
  return {
    id: 'del-1',
    title: 'Test',
    status: 'completed',
    executionRoute: 'local-agent',
    actualCostUsd: 0.5,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    contract: {
      id: 'c1',
      workItemId: 'W-1',
      goal: 'Do something',
      context: '',
      definitionOfDone: [],
      allowedTools: [],
      branchStrategy: 'feature',
      riskClass: 'A',
      maxBudgetUsd: 1,
      requiresApproval: false,
      taskType: 'feat',
    },
    ...overrides,
  } as Delegation
}

beforeEach(() => {
  vi.clearAllMocks()
  mockListByStatus.mockResolvedValue([])
})

describe('GET /api/delegations/metrics', () => {
  it('returns zeroed metrics when no delegations exist', async () => {
    const { GET } = await import('./route')
    const res = await GET()

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.totalDelegations).toBe(0)
    expect(body.totalCostUsd).toBe(0)
    expect(body.successRate).toBe(0)
    expect(body.prMergeRate).toBe(0)
  })

  it('calculates totalCostUsd from actualCostUsd', async () => {
    mockListByStatus.mockResolvedValue([
      makeD({ actualCostUsd: 0.25 }),
      makeD({ id: 'd2', actualCostUsd: 0.75 }),
    ])

    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json()

    expect(body.totalCostUsd).toBe(1.0)
  })

  it('falls back to costEstimateUsd when actualCostUsd is missing', async () => {
    mockListByStatus.mockResolvedValue([
      makeD({ actualCostUsd: undefined, costEstimateUsd: 0.3 }),
    ])

    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json()

    expect(body.totalCostUsd).toBe(0.3)
  })

  it('calculates successRate from completed/terminal delegations', async () => {
    mockListByStatus.mockResolvedValue([
      makeD({ status: 'completed' }),
      makeD({ id: 'd2', status: 'completed' }),
      makeD({ id: 'd3', status: 'failed' }),
      makeD({ id: 'd4', status: 'running' }),
    ])

    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json()

    // 2 completed out of 3 terminal (running is not terminal)
    expect(body.successRate).toBe(67)
    expect(body.completedCount).toBe(2)
    expect(body.failedCount).toBe(1)
    expect(body.runningCount).toBe(1)
  })

  it('calculates prMergeRate correctly', async () => {
    mockListByStatus.mockResolvedValue([
      makeD({ summaryReport: { prUrl: 'https://github.com/x/y/pull/1', prState: 'merged' } as Delegation['summaryReport'] }),
      makeD({ id: 'd2', summaryReport: { prUrl: 'https://github.com/x/y/pull/2', prState: 'open' } as Delegation['summaryReport'] }),
      makeD({ id: 'd3' }),
    ])

    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json()

    // 1 merged out of 2 with PR
    expect(body.prMergeRate).toBe(50)
  })

  it('groups costByRoute by executionRoute', async () => {
    mockListByStatus.mockResolvedValue([
      makeD({ executionRoute: 'local-agent', actualCostUsd: 0.4 }),
      makeD({ id: 'd2', executionRoute: 'local-agent', actualCostUsd: 0.6 }),
      makeD({ id: 'd3', executionRoute: 'ollama-agent', actualCostUsd: 0.0 }),
    ])

    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json()

    expect(body.costByRoute['local-agent']).toBe(1.0)
    expect(body.costByRoute['ollama-agent']).toBe(0.0)
  })

  it('calculates avgCostByRoute correctly', async () => {
    mockListByStatus.mockResolvedValue([
      makeD({ executionRoute: 'local-agent', actualCostUsd: 0.2 }),
      makeD({ id: 'd2', executionRoute: 'local-agent', actualCostUsd: 0.4 }),
    ])

    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json()

    expect(body.avgCostByRoute['local-agent']).toBe(0.3)
  })

  it('includes all required metric fields in response', async () => {
    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json()

    const requiredFields = [
      'totalCostUsd', 'avgDurationMinutes', 'successRate', 'prMergeRate',
      'totalDelegations', 'completedCount', 'failedCount', 'runningCount',
      'costByRoute', 'avgCostByRoute',
    ]
    for (const field of requiredFields) {
      expect(body).toHaveProperty(field)
    }
  })
})
