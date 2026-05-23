import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/repositories/delegationRepository', () => ({
  createDelegationRepository: vi.fn(),
  SINGLE_TENANT_USER_ID: 'user-1',
}))
vi.mock('@/lib/audit', () => ({
  logAuditEvent: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/delegations/batch-approve', () => {
  it('approves pending delegations and returns count', async () => {
    const { createDelegationRepository } = await import('@/lib/repositories/delegationRepository')

    vi.mocked(createDelegationRepository).mockReturnValue({
      findById: vi.fn()
        .mockResolvedValueOnce({ id: 'del-1', status: 'pending', contract: { riskClass: 'B' }, title: 'Task 1', logs: [] })
        .mockResolvedValueOnce({ id: 'del-2', status: 'pending', contract: { riskClass: 'A' }, title: 'Task 2', logs: [] }),
      update: vi.fn().mockResolvedValue({ id: 'del-1', status: 'approved' }),
    } as unknown as ReturnType<typeof createDelegationRepository>)

    const { POST } = await import('./route')
    const req = new Request('http://localhost/api/delegations/batch-approve', {
      method: 'POST',
      body: JSON.stringify({ ids: ['del-1', 'del-2'] }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    const body = await res.json() as { count: number; approved: string[]; skipped: unknown[] }

    expect(res.status).toBe(200)
    expect(body.count).toBe(2)
    expect(body.approved).toHaveLength(2)
  })

  it('skips risk class C delegations', async () => {
    const { createDelegationRepository } = await import('@/lib/repositories/delegationRepository')

    vi.mocked(createDelegationRepository).mockReturnValue({
      findById: vi.fn().mockResolvedValue({ id: 'del-c', status: 'pending', contract: { riskClass: 'C' }, title: 'Risky', logs: [] }),
      update: vi.fn(),
    } as unknown as ReturnType<typeof createDelegationRepository>)

    const { POST } = await import('./route')
    const req = new Request('http://localhost/api/delegations/batch-approve', {
      method: 'POST',
      body: JSON.stringify({ ids: ['del-c'] }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    const body = await res.json() as { count: number; skipped: { id: string; reason: string }[] }

    expect(res.status).toBe(200)
    expect(body.count).toBe(0)
    expect(body.skipped[0].reason).toBe('riskClass C requires manual approval')
  })

  it('returns 400 when ids array is empty', async () => {
    const { POST } = await import('./route')
    const req = new Request('http://localhost/api/delegations/batch-approve', {
      method: 'POST',
      body: JSON.stringify({ ids: [] }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
