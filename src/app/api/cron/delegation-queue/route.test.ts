import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import type { Delegation } from '@/lib/models/delegation'

const queueMock = vi.hoisted(() => ({
  batch: [] as Delegation[],
  stats: {
    pending: 0,
    approved: 0,
    running: 0,
    completed: 0,
    failed: 0,
    cancelled: 0,
    total: 0,
  },
}))

vi.mock('@/lib/delegations/queue', () => ({
  selectNextBatch: vi.fn(() => queueMock.batch),
  getQueueStats: vi.fn(() => queueMock.stats),
}))

vi.mock('@/lib/logger', () => ({
  delegationLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

function makeDelegation(id: string): Delegation {
  return {
    id,
    title: 'Queued delegation',
    status: 'approved',
    executionRoute: 'local-agent',
    costEstimateUsd: 0.1,
    contract: {
      id: `contract-${id}`,
      workItemId: 'JOK-1',
      goal: 'Do queued work',
      context: '',
      definitionOfDone: ['Done'],
      riskClass: 'A',
      maxBudgetUsd: 1,
      allowedTools: [],
      branchStrategy: 'feature',
      requiresApproval: false,
      privacyMode: 'local',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

function request(headers?: HeadersInit): NextRequest {
  return new NextRequest('http://localhost:3000/api/cron/delegation-queue', { headers })
}

describe('GET /api/cron/delegation-queue', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    queueMock.batch = []
    queueMock.stats = {
      pending: 0,
      approved: 0,
      running: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
      total: 0,
    }
    process.env = { ...originalEnv, NODE_ENV: 'test' }
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    process.env = originalEnv
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('requires the cron secret when configured', async () => {
    process.env.CRON_SECRET = 'secret'
    const { GET } = await import('./route')

    const response = await GET(request())

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
  })

  it('returns an empty queue result when no delegation can run', async () => {
    const { GET } = await import('./route')

    const response = await GET(request())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({ ok: true, triggered: 0, failed: 0, results: [] })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('triggers approved delegations via GET for Vercel Cron', async () => {
    queueMock.batch = [makeDelegation('del-1'), makeDelegation('del-2')]
    vi.mocked(global.fetch).mockResolvedValue({ ok: true, status: 200 } as Response)
    const { GET } = await import('./route')

    const response = await GET(request())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({ ok: true, triggered: 2, failed: 0 })
    expect(global.fetch).toHaveBeenCalledTimes(2)
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/delegations/del-1/execute',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('counts non-2xx execution responses as failed', async () => {
    queueMock.batch = [makeDelegation('del-ok'), makeDelegation('del-fail')]
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({ ok: true, status: 200 } as Response)
      .mockResolvedValueOnce({ ok: false, status: 500 } as Response)
    const { GET } = await import('./route')

    const response = await GET(request())
    const body = await response.json()

    expect(response.status).toBe(207)
    expect(body).toMatchObject({ ok: false, triggered: 1, failed: 1 })
    expect(body.results).toEqual([
      { id: 'del-ok', status: 200, ok: true },
      { id: 'del-fail', status: 500, ok: false },
    ])
  })

  it('normalizes VERCEL_URL to a valid https origin', async () => {
    queueMock.batch = [makeDelegation('del-vercel')]
    process.env.VERCEL_URL = 'forgepilot.example.vercel.app'
    vi.mocked(global.fetch).mockResolvedValue({ ok: true, status: 200 } as Response)
    const { GET } = await import('./route')

    await GET(request())

    expect(global.fetch).toHaveBeenCalledWith(
      'https://forgepilot.example.vercel.app/api/delegations/del-vercel/execute',
      expect.objectContaining({ method: 'POST' }),
    )
  })
})
