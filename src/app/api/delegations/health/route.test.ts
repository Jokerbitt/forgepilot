import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/delegations/health', () => ({
  analyzeFleetHealth: vi.fn(),
}))
vi.mock('@/lib/repositories/delegationRepository', () => ({
  createDelegationRepository: vi.fn(),
  SINGLE_TENANT_USER_ID: 'single-tenant',
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/delegations/health', () => {
  it('returns fleet health snapshot', async () => {
    const { createDelegationRepository } = await import('@/lib/repositories/delegationRepository')
    const { analyzeFleetHealth } = await import('@/lib/delegations/health')

    vi.mocked(createDelegationRepository).mockReturnValue({
      listByStatus: vi.fn().mockResolvedValue([]),
    } as unknown as ReturnType<typeof createDelegationRepository>)

    vi.mocked(analyzeFleetHealth).mockReturnValue({
      generatedAt: new Date().toISOString(),
      total: 0,
      byStatus: {} as Record<string, number>,
      flagged: [],
    })

    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json() as { total: number; flagged: unknown[] }

    expect(res.status).toBe(200)
    expect(typeof body.total).toBe('number')
    expect(Array.isArray(body.flagged)).toBe(true)
  })
})
