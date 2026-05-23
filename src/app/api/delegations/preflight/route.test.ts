import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/connectors/config', () => ({
  readStoredApiKeys: vi.fn().mockReturnValue({}),
}))
vi.mock('@/lib/preflight', () => ({
  runPreflight: vi.fn(),
}))
vi.mock('@/lib/repositories/delegationRepository', () => ({
  createDelegationRepository: vi.fn(),
  SINGLE_TENANT_USER_ID: 'user-1',
}))

beforeEach(() => {
  vi.clearAllMocks()
})

const MOCK_DELEGATION = {
  id: 'del-1',
  title: 'Add auth tests',
  status: 'pending',
  contract: { riskClass: 'B' },
}

describe('POST /api/delegations/preflight', () => {
  it('runs preflight and returns result', async () => {
    const { createDelegationRepository } = await import('@/lib/repositories/delegationRepository')
    const { runPreflight } = await import('@/lib/preflight')

    vi.mocked(createDelegationRepository).mockReturnValue({
      findById: vi.fn().mockResolvedValue(MOCK_DELEGATION),
    } as unknown as ReturnType<typeof createDelegationRepository>)

    vi.mocked(runPreflight).mockResolvedValue({
      passed: true,
      checks: [{ name: 'repo-access', ok: true }],
    } as unknown as Awaited<ReturnType<typeof runPreflight>>)

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/delegations/preflight', {
      method: 'POST',
      body: JSON.stringify({ delegationId: 'del-1' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    const body = await res.json() as { passed: boolean }

    expect(res.status).toBe(200)
    expect(body.passed).toBe(true)
  })

  it('returns 404 when delegation is not found', async () => {
    const { createDelegationRepository } = await import('@/lib/repositories/delegationRepository')

    vi.mocked(createDelegationRepository).mockReturnValue({
      findById: vi.fn().mockResolvedValue(null),
    } as unknown as ReturnType<typeof createDelegationRepository>)

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/delegations/preflight', {
      method: 'POST',
      body: JSON.stringify({ delegationId: 'missing' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(404)
  })

  it('returns 400 when delegationId is missing', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/delegations/preflight', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
