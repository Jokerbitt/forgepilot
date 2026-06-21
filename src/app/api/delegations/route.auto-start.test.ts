/**
 * Tests for the M20.4 auto-start hook in POST /api/delegations.
 * When autoStartApproved=true and a delegation is created as 'approved',
 * the execute endpoint is triggered fire-and-forget.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { Delegation } from '@/lib/models/delegation'

const mockCreate = vi.fn(async (d: unknown) => d as Delegation)
const mockUpdate = vi.fn(async (_id: string, d: Partial<Delegation>) => d as Delegation)
const mockFindById = vi.fn(async () => null)
const mockListByStatus = vi.fn(async () => [] as Delegation[])
const mockFetch = vi.fn(async () => new Response('{}', { status: 200 }))
vi.stubGlobal('fetch', mockFetch)

vi.mock('@/lib/repositories/delegationRepository', () => ({
  SINGLE_TENANT_USER_ID: 'user-1',
  getDelegationStorageMode: vi.fn(() => 'json'),
  createDelegationRepository: vi.fn(() => ({
    create: mockCreate,
    update: mockUpdate,
    findById: mockFindById,
    listByStatus: mockListByStatus,
    delete: vi.fn(async () => true),
  })),
}))

vi.mock('@/lib/delegations/watchdog', () => ({
  reapStaleDelegations: vi.fn(),
}))

vi.mock('@/lib/nba-engine/nba-config', () => ({
  getNBAConfig: vi.fn(() => ({
    approvalMode: 'autopilot',
    maxConcurrentAgents: 2,
    autoStartApproved: false,
    budgetEnforcement: 'tolerant' as const,
    budgetTolerancePct: 20,
  })),
}))

vi.mock('@/lib/logger', () => ({
  apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

const baseBody = {
  contract: {
    goal: 'Build the main screen for the app',
    riskClass: 'A',
    privacyMode: 'local',
    requiresApproval: false,
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFetch.mockResolvedValue(new Response('{}', { status: 200 }))
})

describe('POST /api/delegations — auto-start hook (M20.4)', () => {
  it('does NOT trigger execute when autoStartApproved is false', async () => {
    const { getNBAConfig } = await import('@/lib/nba-engine/nba-config')
    vi.mocked(getNBAConfig).mockReturnValue({ autoStartApproved: false } as ReturnType<typeof getNBAConfig>)

    mockCreate.mockResolvedValueOnce({
      id: 'del-auto-1',
      status: 'approved',
      contract: baseBody.contract,
    } as unknown as Delegation)

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/delegations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(baseBody),
    })
    await POST(req)

    const executeFetches = (mockFetch.mock.calls as unknown as Array<[string, RequestInit?]>)
      .filter(([url]) => url.includes('/execute'))
    expect(executeFetches).toHaveLength(0)
  })

  it('triggers execute fire-and-forget when autoStartApproved is true and delegation is approved', async () => {
    const { getNBAConfig } = await import('@/lib/nba-engine/nba-config')
    vi.mocked(getNBAConfig).mockReturnValue({ autoStartApproved: true } as ReturnType<typeof getNBAConfig>)

    mockCreate.mockResolvedValueOnce({
      id: 'del-auto-2',
      status: 'approved',
      contract: baseBody.contract,
      title: 'Auto start me',
    } as unknown as Delegation)

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/delegations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(baseBody),
    })
    await POST(req)

    // Wait one tick for the void promise to resolve
    await Promise.resolve()

    const executeFetches = (mockFetch.mock.calls as unknown as Array<[string, RequestInit?]>)
      .filter(([url]) => typeof url === 'string' && url.includes('del-auto-2/execute'))
    expect(executeFetches).toHaveLength(1)
    expect(executeFetches[0][1]?.method).toBe('POST')
  })

  it('does NOT trigger execute for a pending delegation even if autoStartApproved is true', async () => {
    const { getNBAConfig } = await import('@/lib/nba-engine/nba-config')
    vi.mocked(getNBAConfig).mockReturnValue({ autoStartApproved: true } as ReturnType<typeof getNBAConfig>)

    mockCreate.mockResolvedValueOnce({
      id: 'del-pending',
      status: 'pending',
      contract: { ...baseBody.contract, requiresApproval: true },
    } as unknown as Delegation)

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/delegations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...baseBody, contract: { ...baseBody.contract, requiresApproval: true } }),
    })
    await POST(req)
    await Promise.resolve()

    const executeFetches = (mockFetch.mock.calls as unknown as Array<[string, RequestInit?]>)
      .filter(([url]) => typeof url === 'string' && url.includes('/execute'))
    expect(executeFetches).toHaveLength(0)
  })
})
