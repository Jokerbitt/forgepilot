import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'
import type { Delegation } from '@/lib/models/delegation'

const { mockListByStatus, mockReapStaleDelegations, mockRequireAuth } = vi.hoisted(() => ({
  mockListByStatus: vi.fn(),
  mockReapStaleDelegations: vi.fn(),
  mockRequireAuth: vi.fn(),
}))

vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: mockRequireAuth,
}))

vi.mock('@/lib/repositories/delegationRepository', () => ({
  SINGLE_TENANT_USER_ID: 'single-tenant',
  createDelegationRepository: vi.fn(() => ({
    listByStatus: mockListByStatus,
  })),
}))

vi.mock('@/lib/delegations/watchdog', () => ({
  reapStaleDelegations: mockReapStaleDelegations,
}))

import { GET } from './route'

function delegation(overrides: Partial<Delegation> = {}): Delegation {
  return {
    id: 'del-1',
    title: 'Approved work',
    status: 'approved',
    executionRoute: 'runner',
    costEstimateUsd: 1,
    priority: 1,
    createdAt: '2026-05-22T10:00:00.000Z',
    updatedAt: '2026-05-22T10:05:00.000Z',
    contract: {
      id: 'contract-1',
      workItemId: 'JOK-193',
      goal: 'Execute one small task',
      context: '',
      definitionOfDone: ['Done'],
      riskClass: 'A',
      maxBudgetUsd: 1,
      allowedTools: ['read', 'write'],
      branchStrategy: 'feature',
      requiresApproval: false,
      privacyMode: 'local',
      createdAt: '2026-05-22T10:00:00.000Z',
    },
    ...overrides,
  }
}

describe('GET /api/delegations/queue-plan', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAuth.mockResolvedValue(null)
    mockListByStatus.mockResolvedValue([])
    mockReapStaleDelegations.mockResolvedValue({ reaped: 0, checked: 0 })
  })

  it('requires auth before reading the queue', async () => {
    mockRequireAuth.mockResolvedValue(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))

    const response = await GET()
    expect(response.status).toBe(401)
    expect(mockListByStatus).not.toHaveBeenCalled()
    expect(mockReapStaleDelegations).not.toHaveBeenCalled()
  })

  it('returns a safe queue plan for pending, approved and running delegations', async () => {
    mockListByStatus.mockResolvedValue([
      delegation({ id: 'low', priority: 1 }),
      delegation({ id: 'high', priority: 10 }),
      delegation({ id: 'pending', status: 'pending' }),
    ])

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(mockReapStaleDelegations).toHaveBeenCalledTimes(1)
    expect(mockReapStaleDelegations.mock.invocationCallOrder[0]).toBeLessThan(
      mockListByStatus.mock.invocationCallOrder[0],
    )
    expect(mockListByStatus).toHaveBeenCalledWith(['pending', 'approved', 'running'])
    expect(body.plan).toMatchObject({
      mode: 'safe-preview',
      recommendedStartIds: ['high', 'low'],
      recommendedBatchSize: 2,
    })
    expect(body.plan.recommendedBatch[0]).toMatchObject({
      id: 'high',
      actionHref: '/api/delegations/high/start',
    })
  })

  it('does not recommend approved delegations that the runner would block', async () => {
    mockListByStatus.mockResolvedValue([
      delegation({
        id: 'no-budget',
        priority: 10,
        contract: {
          ...delegation().contract,
          maxBudgetUsd: 0,
        },
      }),
    ])

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.plan).toMatchObject({
      recommendedStartIds: [],
      blockedStartIds: ['no-budget'],
      recommendedBatchSize: 0,
    })
    expect(body.plan.blockedStart[0]).toMatchObject({
      id: 'no-budget',
      blocker: 'Set maxBudgetUsd greater than 0 before automatic execution.',
    })
    expect(body.plan.blockedStart[0]).not.toHaveProperty('actionHref')
  })
})
