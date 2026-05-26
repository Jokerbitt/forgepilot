import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Delegation, DelegationStatus } from '@/lib/models/delegation'

const mockApproved: Partial<Delegation>[] = [
  { id: 'd1', title: 'Build screen', status: 'approved', contract: { riskClass: 'A' } as Delegation['contract'] },
  { id: 'd2', title: 'Add persistence', status: 'approved', contract: { riskClass: 'B' } as Delegation['contract'] },
  { id: 'd3', title: 'Dangerous task', status: 'approved', contract: { riskClass: 'C' } as Delegation['contract'] },
]

const mockListByStatus = vi.fn(async (statuses?: DelegationStatus[]) => {
  if (statuses?.includes('approved')) return [...mockApproved] as Delegation[]
  if (statuses?.includes('running')) return []
  return []
})

vi.mock('@/lib/repositories/delegationRepository', () => ({
  SINGLE_TENANT_USER_ID: 'user-1',
  createDelegationRepository: vi.fn(() => ({
    listByStatus: mockListByStatus,
    create: vi.fn(),
    findById: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  })),
}))

vi.mock('@/lib/nba-engine/nba-config', () => ({
  getNBAConfig: vi.fn(() => ({ approvalMode: 'autopilot', maxConcurrentAgents: 2, autoStartApproved: false })),
}))

vi.mock('@/lib/logger', () => ({
  apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

const mockFetch = vi.fn(async () => new Response('{}', { status: 200 }))
vi.stubGlobal('fetch', mockFetch)

beforeEach(() => {
  vi.clearAllMocks()
  mockFetch.mockResolvedValue(new Response('{}', { status: 200 }))
  mockListByStatus.mockImplementation(async (statuses?: DelegationStatus[]) => {
    if (statuses?.includes('approved')) return [...mockApproved] as Delegation[]
    if (statuses?.includes('running')) return []
    return []
  })
})

describe('POST /api/delegations/batch-execute', () => {
  it('returns triggered IDs and skipped list', async () => {
    const { POST } = await import('./route')
    const res = await POST()

    expect(res.status).toBe(200)
    const body = await res.json() as { triggered: string[]; skipped: Array<{ id: string; reason: string }>; count: number }
    expect(body.triggered).toContain('d1')
    expect(body.triggered).toContain('d2')
    expect(body.count).toBe(2)
  })

  it('always skips Risk Class C delegations', async () => {
    const { POST } = await import('./route')
    const res = await POST()
    const body = await res.json() as { triggered: string[]; skipped: Array<{ id: string; reason: string }> }

    expect(body.triggered).not.toContain('d3')
    const skippedC = body.skipped.find(s => s.id === 'd3')
    expect(skippedC?.reason).toContain('riskClass C')
  })

  it('respects concurrency limit — skips when running slots are full', async () => {
    const runningDelegation = { id: 'r1', status: 'running', contract: { riskClass: 'A' } } as Delegation
    mockListByStatus.mockImplementation(async (statuses?: DelegationStatus[]) => {
      if (statuses?.includes('approved')) return [mockApproved[0], mockApproved[1]] as Delegation[]
      if (statuses?.includes('running')) return [runningDelegation, runningDelegation] // 2 running = limit reached
      return []
    })

    const { POST } = await import('./route')
    const res = await POST()
    const body = await res.json() as { triggered: string[]; skipped: Array<{ id: string; reason: string }> }

    expect(body.triggered).toHaveLength(0)
    expect(body.skipped.every(s => s.reason === 'concurrency limit reached')).toBe(true)
  })

  it('respects partial concurrency — triggers only remaining slots', async () => {
    const { getNBAConfig } = await import('@/lib/nba-engine/nba-config')
    vi.mocked(getNBAConfig).mockReturnValue({ approvalMode: 'autopilot', maxConcurrentAgents: 2, autoStartApproved: false } as ReturnType<typeof getNBAConfig>)

    const runningDelegation = { id: 'r1', status: 'running', contract: { riskClass: 'A' } } as Delegation
    mockListByStatus.mockImplementation(async (statuses?: DelegationStatus[]) => {
      if (statuses?.includes('approved')) return [mockApproved[0], mockApproved[1]] as Delegation[]
      if (statuses?.includes('running')) return [runningDelegation] // 1 running, 1 slot left
      return []
    })

    const { POST } = await import('./route')
    const res = await POST()
    const body = await res.json() as { triggered: string[]; skipped: Array<{ id: string; reason: string }> }

    expect(body.triggered).toHaveLength(1)
    expect(body.skipped).toHaveLength(1)
    expect(body.skipped[0].reason).toBe('concurrency limit reached')
  })

  it('returns 200 with empty triggered list when no approved delegations', async () => {
    mockListByStatus.mockResolvedValue([])

    const { POST } = await import('./route')
    const res = await POST()
    const body = await res.json() as { triggered: string[]; count: number }

    expect(res.status).toBe(200)
    expect(body.triggered).toHaveLength(0)
    expect(body.count).toBe(0)
  })

  it('includes concurrencyLimit and slotsUsed in response', async () => {
    const { POST } = await import('./route')
    const res = await POST()
    const body = await res.json() as { concurrencyLimit: number; slotsUsed: number }

    expect(body.concurrencyLimit).toBe(2)
    expect(body.slotsUsed).toBe(0)
  })

  it('fires fetch for each triggered delegation', async () => {
    const { POST } = await import('./route')
    await POST()
    // d1 and d2 should be triggered (d3 is risk C)
    expect(mockFetch).toHaveBeenCalledTimes(2)
    const calls = mockFetch.mock.calls as unknown as Array<[string, RequestInit?]>
    const urls = calls.map(c => c[0])
    expect(urls.some(u => u.includes('d1/execute'))).toBe(true)
    expect(urls.some(u => u.includes('d2/execute'))).toBe(true)
  })
})
