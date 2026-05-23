import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/delegations/contract-versions', () => ({
  getVersionHistory: vi.fn(),
  saveVersion: vi.fn(),
}))
vi.mock('@/lib/logger', () => ({
  apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/delegations/versions', () => {
  it('returns version history for a delegation', async () => {
    const { getVersionHistory } = await import('@/lib/delegations/contract-versions')
    vi.mocked(getVersionHistory).mockResolvedValue([
      { version: 1, savedAt: '2024-01-01', reason: 'initial' },
      { version: 2, savedAt: '2024-01-02', reason: 'updated' },
    ] as unknown as Awaited<ReturnType<typeof getVersionHistory>>)

    const { GET } = await import('./route')
    const res = await GET(new NextRequest('http://localhost/api/delegations/versions?delegationId=del-1'))
    const body = await res.json() as { delegationId: string; count: number; versions: unknown[] }

    expect(res.status).toBe(200)
    expect(body.delegationId).toBe('del-1')
    expect(body.count).toBe(2)
    expect(body.versions).toHaveLength(2)
  })

  it('returns 400 when delegationId is missing', async () => {
    const { GET } = await import('./route')
    const res = await GET(new NextRequest('http://localhost/api/delegations/versions'))
    expect(res.status).toBe(400)
  })
})

describe('POST /api/delegations/versions', () => {
  it('saves a new version and returns 201', async () => {
    const { saveVersion } = await import('@/lib/delegations/contract-versions')
    vi.mocked(saveVersion).mockResolvedValue({
      version: 3,
      savedAt: '2024-01-03',
      reason: 'scope change',
    } as unknown as Awaited<ReturnType<typeof saveVersion>>)

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/delegations/versions', {
      method: 'POST',
      body: JSON.stringify({
        delegationId: 'del-1',
        contract: {
          id: 'c-1', workItemId: 'wi-1', goal: 'Build auth', context: 'Auth module',
          definitionOfDone: ['Tests pass'], riskClass: 'B', maxBudgetUsd: 1,
          allowedTools: ['read', 'write'], branchStrategy: 'feature',
          requiresApproval: false, privacyMode: 'local', createdAt: '2024-01-01T00:00:00.000Z',
        },
        delegation: { id: 'del-1', title: 'Test' },
        reason: 'scope change',
      }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    const body = await res.json() as { version: { version: number } }

    expect(res.status).toBe(201)
    expect(body.version.version).toBe(3)
  })

  it('returns 400 when required fields are missing', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/delegations/versions', {
      method: 'POST',
      body: JSON.stringify({ reason: 'no id here' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
