import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/drift-detector', () => ({
  analyzeDrift: vi.fn(),
}))
vi.mock('@/lib/budget-utils', () => ({
  budgetToMaxTurns: vi.fn().mockReturnValue(15),
}))
vi.mock('@/lib/repositories/delegationRepository', () => ({
  createDelegationRepository: vi.fn(),
  SINGLE_TENANT_USER_ID: 'single-tenant',
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/delegations/drift', () => {
  it('returns drift analysis for all running delegations when no id provided', async () => {
    const { createDelegationRepository } = await import('@/lib/repositories/delegationRepository')
    const { analyzeDrift } = await import('@/lib/drift-detector')

    vi.mocked(createDelegationRepository).mockReturnValue({
      listByStatus: vi.fn().mockResolvedValue([
        { id: 'del-1', status: 'running', title: 'Test task', contract: { goal: 'Do something', maxBudgetUsd: 1 }, logs: [] },
      ]),
      findById: vi.fn(),
    } as unknown as ReturnType<typeof createDelegationRepository>)

    vi.mocked(analyzeDrift).mockReturnValue({
      hasDrift: false,
      driftScore: 0,
      signals: [],
      estimatedTurns: 0,
      recommendation: 'Agent arbeitet fokussiert',
    })

    const { GET } = await import('./route')
    const req = new Request('http://localhost/api/delegations/drift')
    const res = await GET(req)
    const body = await res.json() as unknown[]

    expect(res.status).toBe(200)
    expect(Array.isArray(body)).toBe(true)
    expect(body).toHaveLength(1)
  })

  it('returns drift for specific delegation by id', async () => {
    const { createDelegationRepository } = await import('@/lib/repositories/delegationRepository')
    const { analyzeDrift } = await import('@/lib/drift-detector')

    const mockDelegation = {
      id: 'del-1',
      status: 'running',
      title: 'Test',
      contract: { goal: 'Do something', maxBudgetUsd: 1 },
      logs: [],
    }

    vi.mocked(createDelegationRepository).mockReturnValue({
      findById: vi.fn().mockResolvedValue(mockDelegation),
      listByStatus: vi.fn(),
    } as unknown as ReturnType<typeof createDelegationRepository>)

    vi.mocked(analyzeDrift).mockReturnValue({
      hasDrift: false,
      driftScore: 0,
      signals: [],
      estimatedTurns: 0,
      recommendation: 'Agent arbeitet fokussiert',
    })

    const { GET } = await import('./route')
    const req = new Request('http://localhost/api/delegations/drift?id=del-1')
    const res = await GET(req)
    const body = await res.json() as { delegationId: string }

    expect(res.status).toBe(200)
    expect(body.delegationId).toBe('del-1')
  })

  it('returns 404 when specific delegation not found', async () => {
    const { createDelegationRepository } = await import('@/lib/repositories/delegationRepository')

    vi.mocked(createDelegationRepository).mockReturnValue({
      findById: vi.fn().mockResolvedValue(undefined),
      listByStatus: vi.fn(),
    } as unknown as ReturnType<typeof createDelegationRepository>)

    const { GET } = await import('./route')
    const req = new Request('http://localhost/api/delegations/drift?id=unknown')
    const res = await GET(req)
    expect(res.status).toBe(404)
  })
})
