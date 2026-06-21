import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/delegations/plan-generator', () => ({
  getPlan: vi.fn(),
}))

vi.mock('@/lib/repositories/delegationRepository', () => ({
  SINGLE_TENANT_USER_ID: 'test-user',
  createDelegationRepository: vi.fn(() => ({
    findById: vi.fn(),
  })),
}))

import { GET } from './route'
import { getPlan } from '@/lib/delegations/plan-generator'
import { createDelegationRepository } from '@/lib/repositories/delegationRepository'

const mockGetPlan = vi.mocked(getPlan)
const mockCreateRepo = vi.mocked(createDelegationRepository)

function makeRequest() {
  return new Request('http://localhost/api/delegations/plan/plan-1')
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

const basePlan = {
  id: 'plan-1',
  goal: 'Build auth',
  context: '',
  targetRepo: '',
  overview: 'Auth overview',
  status: 'executing' as const,
  maxPhases: 3,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  phases: [
    {
      id: 'p1',
      title: 'Phase 1',
      description: 'Setup',
      filesToCreate: [],
      filesToModify: [],
      dodItems: ['Tests pass'],
      riskClass: 'B' as const,
      estimatedTurns: 30,
      dependsOn: [],
      delegationId: 'del-1',
    },
    {
      id: 'p2',
      title: 'Phase 2',
      description: 'Implement',
      filesToCreate: [],
      filesToModify: [],
      dodItems: [],
      riskClass: 'A' as const,
      estimatedTurns: 20,
      dependsOn: ['p1'],
      delegationId: undefined,
    },
  ],
}

describe('GET /api/delegations/plan/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 404 when plan not found', async () => {
    mockGetPlan.mockReturnValue(null)
    const res = await GET(makeRequest(), makeParams('missing'))
    expect(res.status).toBe(404)
  })

  it('returns plan status with phases', async () => {
    mockGetPlan.mockReturnValue(basePlan)
    const mockFindById = vi.fn().mockResolvedValue({
      id: 'del-1',
      status: 'completed',
      completedAt: '2024-01-01T01:00:00Z',
      summaryReport: { prUrl: 'https://github.com/test/repo/pull/1' },
      retryCount: 0,
    })
    mockCreateRepo.mockReturnValue({ findById: mockFindById } as unknown as ReturnType<typeof createDelegationRepository>)

    const res = await GET(makeRequest(), makeParams('plan-1'))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.id).toBe('plan-1')
    expect(body.goal).toBe('Build auth')
    expect(body.phases).toHaveLength(2)
  })

  it('sets delegation null for phases without delegationId', async () => {
    mockGetPlan.mockReturnValue(basePlan)
    const mockFindById = vi.fn().mockResolvedValue({
      id: 'del-1',
      status: 'running',
      summaryReport: {},
    })
    mockCreateRepo.mockReturnValue({ findById: mockFindById } as unknown as ReturnType<typeof createDelegationRepository>)

    const res = await GET(makeRequest(), makeParams('plan-1'))
    const body = await res.json()
    // Phase 2 has no delegationId → delegation should be null
    expect(body.phases[1].delegation).toBeNull()
  })

  it('computes summary counts correctly', async () => {
    mockGetPlan.mockReturnValue(basePlan)
    const mockFindById = vi.fn().mockResolvedValue({
      id: 'del-1',
      status: 'completed',
      summaryReport: {},
    })
    mockCreateRepo.mockReturnValue({ findById: mockFindById } as unknown as ReturnType<typeof createDelegationRepository>)

    const res = await GET(makeRequest(), makeParams('plan-1'))
    const body = await res.json()
    expect(body.summary.total).toBe(2)
    expect(body.summary.completed).toBe(1)
    // Phase 2 has no delegationId → counts as pending
    expect(body.summary.pending).toBe(1)
  })

  it('includes prUrl from summaryReport', async () => {
    mockGetPlan.mockReturnValue(basePlan)
    mockCreateRepo.mockReturnValue({
      findById: vi.fn().mockResolvedValue({
        id: 'del-1',
        status: 'completed',
        summaryReport: { prUrl: 'https://github.com/test/repo/pull/42' },
      }),
    } as unknown as ReturnType<typeof createDelegationRepository>)

    const res = await GET(makeRequest(), makeParams('plan-1'))
    const body = await res.json()
    expect(body.phases[0].delegation.prUrl).toBe('https://github.com/test/repo/pull/42')
  })

  it('summary.running reflects active delegations', async () => {
    const runningPlan = {
      ...basePlan,
      phases: [{ ...basePlan.phases[0], delegationId: 'del-running' }],
    }
    mockGetPlan.mockReturnValue(runningPlan)
    mockCreateRepo.mockReturnValue({
      findById: vi.fn().mockResolvedValue({ id: 'del-running', status: 'running', summaryReport: {} }),
    } as unknown as ReturnType<typeof createDelegationRepository>)

    const res = await GET(makeRequest(), makeParams('plan-1'))
    const body = await res.json()
    expect(body.summary.running).toBe(1)
    expect(body.summary.completed).toBe(0)
  })
})
