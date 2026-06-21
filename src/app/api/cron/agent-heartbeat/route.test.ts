import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GET, POST } from './route'
import { NextRequest } from 'next/server'

vi.mock('@/lib/cron/auth', () => ({
  isCronAuthorized: vi.fn(() => true),
}))

vi.mock('@/lib/repositories/delegationRepository', () => ({
  SINGLE_TENANT_USER_ID: 'user-1',
  createDelegationRepository: vi.fn(() => ({
    listByStatus: vi.fn(async () => []),
    update: vi.fn(async () => {}),
  })),
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

function makeRequest(authorized = true): NextRequest {
  return new NextRequest('http://localhost/api/cron/agent-heartbeat', {
    headers: authorized ? { authorization: 'Bearer test-secret' } : {},
  })
}

describe('/api/cron/agent-heartbeat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('GET returns 200 with idle stats when no running delegations', async () => {
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json() as { ok: boolean; checked: number }
    expect(body.ok).toBe(true)
    expect(body.checked).toBe(0)
  })

  it('POST returns 200 with idle stats when no running delegations', async () => {
    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
  })

  it('returns 401 when unauthorized', async () => {
    const { isCronAuthorized } = await import('@/lib/cron/auth')
    vi.mocked(isCronAuthorized).mockReturnValueOnce(false)
    const res = await GET(makeRequest(false))
    expect(res.status).toBe(401)
  })

  it('marks stale delegation as failed', async () => {
    const { createDelegationRepository } = await import('@/lib/repositories/delegationRepository')
    const updateMock = vi.fn(async () => {})
    const staleDate = new Date(Date.now() - 35 * 60 * 1000).toISOString()
    vi.mocked(createDelegationRepository).mockReturnValueOnce({
      listByStatus: vi.fn(async () => [{
        id: 'stale-1',
        status: 'running',
        createdAt: staleDate,
        updatedAt: staleDate,
        logs: [{ timestamp: staleDate, type: 'info', message: 'started' }],
        contract: {},
      }]),
      update: updateMock,
    } as unknown as ReturnType<typeof createDelegationRepository>)

    const res = await GET(makeRequest())
    const body = await res.json() as { stale: number; affected: string[] }
    expect(body.stale).toBe(1)
    expect(body.affected).toContain('stale-1')
    expect(updateMock).toHaveBeenCalledWith('stale-1', expect.objectContaining({ status: 'failed' }))
  })

  it('marks zombie delegation (4h+ running) as failed', async () => {
    const { createDelegationRepository } = await import('@/lib/repositories/delegationRepository')
    const updateMock = vi.fn(async () => {})
    const zombieDate = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString()
    vi.mocked(createDelegationRepository).mockReturnValueOnce({
      listByStatus: vi.fn(async () => [{
        id: 'zombie-1',
        status: 'running',
        createdAt: zombieDate,
        updatedAt: zombieDate,
        logs: [{ timestamp: zombieDate, type: 'info', message: 'still running' }],
        contract: {},
      }]),
      update: updateMock,
    } as unknown as ReturnType<typeof createDelegationRepository>)

    const res = await GET(makeRequest())
    const body = await res.json() as { zombies: number }
    expect(body.zombies).toBe(1)
    expect(updateMock).toHaveBeenCalledWith('zombie-1', expect.objectContaining({ status: 'failed' }))
  })
})
