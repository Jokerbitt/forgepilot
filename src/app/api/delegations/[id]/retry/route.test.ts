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
  return { params: Promise.resolve({ id }) }
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

  it('resets failed delegation to pending with retry diagnostics', async () => {
    const res = await POST(new Request('http://localhost'), makeParams('del-001'))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toMatchObject({
      retried: true,
      delegationId: 'del-001',
      retryCount: 1,
      failureCause: 'unknown',
    })
  })

  it('blocks cancelled delegation from automatic retry', async () => {
    store.data = JSON.stringify([{ ...failedDelegation, status: 'cancelled' }])
    const res = await POST(new Request('http://localhost'), makeParams('del-001'))
    expect(res.status).toBe(409)
    const data = await res.json()
    expect(data).toMatchObject({
      failureCause: 'cancelled',
      retryCount: 0,
    })
  })

  it('blocks retry when max retry count is reached', async () => {
    store.data = JSON.stringify([{
      ...failedDelegation,
      logs: [
        { timestamp: '2026-01-01T00:00:00Z', type: 'info', message: 'Erneut eingereicht (Retry #1)' },
        { timestamp: '2026-01-01T00:01:00Z', type: 'info', message: 'Erneut eingereicht (Retry #2)' },
        { timestamp: '2026-01-01T00:02:00Z', type: 'info', message: 'Erneut eingereicht (Retry #3)' },
      ],
    }])
    const res = await POST(new Request('http://localhost'), makeParams('del-001'))
    expect(res.status).toBe(429)
    const data = await res.json()
    expect(data).toMatchObject({
      failureCause: 'max-retries',
      retryCount: 3,
    })
  })

  it('adds retry guidance to the delegation context', async () => {
    store.data = JSON.stringify([{ ...failedDelegation, errorMessage: 'TypeScript type error in build' }])
    const res = await POST(new Request('http://localhost'), makeParams('del-001'))
    expect(res.status).toBe(200)

    const saved = JSON.parse(store.data)[0]
    expect(saved.contract.context).toContain('## Retry Guidance')
    expect(saved.contract.context).toContain('TypeScript')
  })
})
