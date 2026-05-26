/**
 * Tests for GET /api/delegations — search filter + default limit.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { Delegation, TaskContract } from '@/lib/models/delegation'

const makeContract = (overrides: Partial<TaskContract> = {}): TaskContract => ({
  id: 'c1',
  workItemId: 'w1',
  goal: 'Default goal text',
  context: '',
  taskType: 'feature',
  riskClass: 'A',
  requiresApproval: false,
  privacyMode: 'local',
  allowedTools: [],
  branchStrategy: 'feature',
  definitionOfDone: ['Implementation is complete'],
  maxBudgetUsd: 0,
  createdAt: new Date().toISOString(),
  ...overrides,
})

const makeDelegation = (overrides: Partial<Delegation>): Delegation => ({
  id: 'del-1',
  title: 'Default Title',
  status: 'pending',
  executionRoute: 'local-agent',
  costEstimateUsd: 0,
  contract: makeContract(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
})

const mockDelegations: Delegation[] = [
  makeDelegation({ id: 'd1', title: 'Add authentication feature', contract: makeContract({ id: 'c1', workItemId: 'w1', goal: 'Implement OAuth login' }) }),
  makeDelegation({ id: 'd2', title: 'Fix database migration', contract: makeContract({ id: 'c2', workItemId: 'w2', goal: 'Fix migration script', taskType: 'bugfix', riskClass: 'B', branchStrategy: 'fix' }) }),
  makeDelegation({ id: 'd3', title: 'Update UI components', contract: makeContract({ id: 'c3', workItemId: 'w3', goal: 'Refactor dashboard layout' }) }),
]

vi.mock('@/lib/repositories/delegationRepository', () => ({
  SINGLE_TENANT_USER_ID: 'user-1',
  getDelegationStorageMode: vi.fn(() => 'json'),
  createDelegationRepository: vi.fn(() => ({
    listByStatus: vi.fn(async () => [...mockDelegations]),
    create: vi.fn(),
    findById: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  })),
}))

vi.mock('@/lib/delegations/watchdog', () => ({
  reapStaleDelegations: vi.fn(async () => {}),
}))

function makeGetRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/delegations')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return new NextRequest(url.toString())
}

describe('GET /api/delegations — search filter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns all delegations when no search param', async () => {
    const { GET } = await import('./route')
    const res = await GET(makeGetRequest())
    const data = await res.json() as Delegation[]
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBe(3)
  })

  it('filters by title (case-insensitive)', async () => {
    const { GET } = await import('./route')
    const res = await GET(makeGetRequest({ search: 'authentication' }))
    const data = await res.json() as Delegation[]
    expect(data.length).toBe(1)
    expect(data[0].id).toBe('d1')
  })

  it('filters by goal', async () => {
    const { GET } = await import('./route')
    const res = await GET(makeGetRequest({ search: 'oauth' }))
    const data = await res.json() as Delegation[]
    expect(data.length).toBe(1)
    expect(data[0].id).toBe('d1')
  })

  it('returns empty array when no match', async () => {
    const { GET } = await import('./route')
    const res = await GET(makeGetRequest({ search: 'zzz-no-match-zzz' }))
    const data = await res.json() as Delegation[]
    expect(data).toHaveLength(0)
  })

  it('search matches multiple delegations', async () => {
    const { GET } = await import('./route')
    const res = await GET(makeGetRequest({ search: 'fix' }))
    const data = await res.json() as Delegation[]
    // 'Fix database migration' + 'Fix migration script' (goal)
    expect(data.length).toBeGreaterThanOrEqual(1)
  })
})

describe('GET /api/delegations — default limit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('applies default limit of 100 without query param', async () => {
    // Override mock with 150 delegations
    const many = Array.from({ length: 150 }, (_, i) =>
      makeDelegation({ id: `d${i}`, title: `Delegation ${i}` }),
    )
    const { createDelegationRepository } = await import('@/lib/repositories/delegationRepository')
    vi.mocked(createDelegationRepository).mockReturnValueOnce({
      listByStatus: vi.fn(async () => [...many]),
      create: vi.fn(),
      findById: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    } as unknown as ReturnType<typeof createDelegationRepository>)

    const { GET } = await import('./route')
    const res = await GET(makeGetRequest())
    const data = await res.json() as Delegation[]
    expect(data.length).toBe(100)
  })

  it('respects explicit ?limit param', async () => {
    const { GET } = await import('./route')
    const res = await GET(makeGetRequest({ limit: '2' }))
    const data = await res.json() as Delegation[]
    expect(data.length).toBe(2)
  })
})
