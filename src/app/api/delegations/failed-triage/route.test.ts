import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'
import type { Delegation } from '@/lib/models/delegation'

const { mockListByStatus, mockRequireAuth, mockUpdate } = vi.hoisted(() => ({
  mockListByStatus: vi.fn(),
  mockRequireAuth: vi.fn(),
  mockUpdate: vi.fn(),
}))

vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: mockRequireAuth,
}))

vi.mock('@/lib/repositories/delegationRepository', () => ({
  SINGLE_TENANT_USER_ID: 'single-tenant',
  createDelegationRepository: vi.fn(() => ({
    listByStatus: mockListByStatus,
    update: mockUpdate,
  })),
}))

import { GET, POST } from './route'

function failedDelegation(overrides: Partial<Delegation> = {}): Delegation {
  return {
    id: 'del-1',
    title: 'Provider timeout',
    status: 'failed',
    executionRoute: 'runner',
    costEstimateUsd: 1,
    errorMessage: 'Request timed out while calling Ollama',
    createdAt: '2026-05-22T10:00:00.000Z',
    updatedAt: '2026-05-22T10:05:00.000Z',
    contract: {
      id: 'contract-1',
      workItemId: 'JOK-193',
      goal: 'Retry failed execution',
      context: '',
      definitionOfDone: ['Retry plan exists'],
      riskClass: 'B',
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

describe('GET /api/delegations/failed-triage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAuth.mockResolvedValue(null)
    mockListByStatus.mockResolvedValue([])
    mockUpdate.mockResolvedValue(null)
  })

  it('requires auth before reading failed delegations', async () => {
    mockRequireAuth.mockResolvedValue(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))

    const response = await GET()
    expect(response.status).toBe(401)
    expect(mockListByStatus).not.toHaveBeenCalled()
  })

  it('returns triage plus safe retry action plan', async () => {
    mockListByStatus.mockResolvedValue([
      failedDelegation({ id: 'del-1', title: 'Provider timeout' }),
      failedDelegation({ id: 'del-2', title: 'Rate limit', errorMessage: 'rate limit exceeded' }),
      failedDelegation({ id: 'del-3', title: 'Missing details', errorMessage: undefined }),
    ])

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(mockListByStatus).toHaveBeenCalledWith(['failed'])
    expect(body.triage).toMatchObject({
      total: 3,
      retryable: 2,
      missingFeedback: 1,
    })
    expect(body.actionPlan).toMatchObject({
      mode: 'safe-preview',
      retryableIds: ['del-1', 'del-2'],
      missingFeedbackIds: ['del-3'],
    })
    expect(body.actionPlan.retryEndpoints[0]).toMatchObject({
      href: '/api/delegations/del-1/retry',
      method: 'POST',
    })
  })

  it('previews safe auto-triage without mutating delegations', async () => {
    mockListByStatus.mockResolvedValue([
      failedDelegation({ id: 'del-1', title: 'Provider timeout' }),
    ])

    const response = await POST(new Request('http://localhost/api/delegations/failed-triage', {
      method: 'POST',
      body: JSON.stringify({ mode: 'preview' }),
    }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.autoTriage).toMatchObject({
      mode: 'preview',
      attempted: 1,
      retried: [expect.objectContaining({ id: 'del-1' })],
    })
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('applies safe auto-triage in bounded batches', async () => {
    mockListByStatus.mockResolvedValue([
      failedDelegation({ id: 'del-1', title: 'Provider timeout' }),
      failedDelegation({ id: 'del-2', title: 'Rate limit', errorMessage: 'rate limit exceeded' }),
    ])

    const response = await POST(new Request('http://localhost/api/delegations/failed-triage', {
      method: 'POST',
      body: JSON.stringify({ mode: 'apply', maxBatchSize: 1 }),
    }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.actionPlan.retryableIds).toEqual(['del-1'])
    expect(body.autoTriage).toMatchObject({
      mode: 'apply',
      attempted: 1,
    })
    expect(mockUpdate).toHaveBeenCalledTimes(1)
    expect(mockUpdate).toHaveBeenCalledWith('del-1', expect.objectContaining({ status: 'pending' }))
  })
})
