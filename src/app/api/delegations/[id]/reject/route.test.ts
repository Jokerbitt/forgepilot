import { describe, expect, it, vi, beforeEach } from 'vitest'
import { POST } from './route'

const pendingDelegation = {
  id: 'del-reject-1',
  status: 'pending' as const,
  executionRoute: 'local-agent' as const,
  costEstimateUsd: 0.25,
  contract: {
    id: 'contract-1',
    workItemId: 'LOCAL-1',
    goal: 'Test rejection',
    context: 'Context',
    definitionOfDone: ['Done'],
    riskClass: 'A' as const,
    maxBudgetUsd: 1,
    allowedTools: ['Read'],
    branchStrategy: 'feature' as const,
    requiresApproval: true,
    privacyMode: 'local' as const,
    createdAt: '2026-05-17T00:00:00Z',
  },
  logs: [],
  createdAt: '2026-05-17T00:00:00Z',
  updatedAt: '2026-05-17T00:00:00Z',
}

const store = { data: JSON.stringify([pendingDelegation]) }

vi.mock('fs', () => ({
  default: {
    readFileSync:  vi.fn(() => store.data),
    writeFileSync: vi.fn((_file: string, data: string) => { store.data = data }),
    renameSync:    vi.fn(),
    existsSync:    vi.fn(() => true),
    mkdirSync:     vi.fn(),
  },
}))

const makeRequest = (body?: unknown) =>
  new Request('http://localhost/api/delegations/del-reject-1/reject', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })

describe('POST /api/delegations/[id]/reject', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    store.data = JSON.stringify([pendingDelegation])
  })

  it('rejects a pending delegation and returns status=rejected', async () => {
    const res = await POST(makeRequest({ actor: 'user', reason: 'Nicht aktuell' }), { params: Promise.resolve({ id: 'del-reject-1' }) })
    expect(res.status).toBe(200)
    const data = await res.json() as { status: string; logs: { message: string }[] }
    expect(data.status).toBe('rejected')
  })

  it('appends a log entry with actor and reason', async () => {
    await POST(makeRequest({ actor: 'user', reason: 'Out of scope' }), { params: Promise.resolve({ id: 'del-reject-1' }) })
    const data = JSON.parse(store.data) as { id: string; logs: { message: string }[] }[]
    const updated = data.find(d => d.id === 'del-reject-1')!
    expect(updated.logs.at(-1)?.message).toContain('user')
    expect(updated.logs.at(-1)?.message).toContain('Out of scope')
  })

  it('returns 404 for unknown delegation', async () => {
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: 'unknown-id' }) })
    expect(res.status).toBe(404)
  })

  it('returns 409 when delegation is not pending', async () => {
    store.data = JSON.stringify([{ ...pendingDelegation, status: 'approved' }])
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: 'del-reject-1' }) })
    expect(res.status).toBe(409)
  })

  it('works without a reason in the body', async () => {
    const res = await POST(makeRequest({ actor: 'system' }), { params: Promise.resolve({ id: 'del-reject-1' }) })
    expect(res.status).toBe(200)
    const data = await res.json() as { status: string }
    expect(data.status).toBe('rejected')
  })
})
