import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from './route'

const store = { data: '[]' }

vi.mock('fs', () => ({
  default: {
    readFileSync: vi.fn(() => store.data),
    writeFileSync: vi.fn((_p: string, d: string) => { store.data = d }),
    renameSync: vi.fn(),
    existsSync: vi.fn(() => true),
    mkdirSync: vi.fn(),
  },
}))

const failedDelegation = {
  id: 'del-001',
  status: 'failed' as const,
  errorMessage: 'Prozess abgestürzt',
  contract: {
    goal: 'Feature X bauen',
    workItemId: 'JOK-1',
    riskClass: 'A',
    requiresApproval: false,
    executionRoute: 'local-agent',
    privacyMode: 'local',
    maxBudgetUsd: 5,
  },
  logs: [],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

function makeParams(id: string) {
  return { params: { id } }
}

describe('POST /api/delegations/[id]/retry', () => {
  beforeEach(() => {
    store.data = JSON.stringify([failedDelegation])
    vi.clearAllMocks()
  })

  it('returns 404 when delegation not found', async () => {
    store.data = '[]'
    const res = await POST(new Request('http://localhost'), makeParams('not-found'))
    expect(res.status).toBe(404)
  })

  it('returns 400 when delegation is not failed or cancelled', async () => {
    store.data = JSON.stringify([{ ...failedDelegation, status: 'running', errorMessage: undefined }])
    const res = await POST(new Request('http://localhost'), makeParams('del-001'))
    expect(res.status).toBe(400)
  })

  it('resets failed delegation to pending', async () => {
    const res = await POST(new Request('http://localhost'), makeParams('del-001'))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toMatchObject({ retried: true, delegationId: 'del-001' })
  })

  it('resets cancelled delegation to pending', async () => {
    store.data = JSON.stringify([{ ...failedDelegation, status: 'cancelled' }])
    const res = await POST(new Request('http://localhost'), makeParams('del-001'))
    expect(res.status).toBe(200)
  })
})
