/**
 * @vitest-environment node
 *
 * Tests for POST /api/autopilot/watchdog — M290
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Delegation } from '@/lib/models/delegation'

// ── Repository mock ──────────────────────────���─────────────────────────────────

const listByStatus = vi.fn<[], Promise<Delegation[]>>()
const update = vi.fn()

vi.mock('@/lib/repositories/delegationRepository', () => ({
  SINGLE_TENANT_USER_ID: 'user-1',
  createDelegationRepository: vi.fn(() => ({ listByStatus, update })),
}))

// ── Process registry mock ───────────��──────────────────────────────────────────

vi.mock('@/lib/process-registry', () => ({
  isProcessAlive: vi.fn(() => false),
}))

// ── Fixture ───────────────────────────────────────────────────────────────────
// Use real Date.now() so silence detection works against the real clock in route.

function makeRunning(id: string, silentMinutes: number): Delegation {
  const now = Date.now()
  return {
    id,
    title: `Delegation ${id}`,
    status: 'running',
    executionRoute: 'local-agent',
    costEstimateUsd: 0,
    retryCount: 0,
    contract: {
      id: `c-${id}`,
      workItemId: 'W-1',
      goal: 'do something',
      riskClass: 'A',
      maxBudgetUsd: 1,
      requiresApproval: false,
      privacyMode: 'local',
      createdAt: new Date(now).toISOString(),
    },
    logs: [],
    createdAt: new Date(now).toISOString(),
    updatedAt: new Date(now - silentMinutes * 60_000).toISOString(),
  }
}

function makeRequest(timeoutMinutes?: number) {
  const url = timeoutMinutes
    ? `http://localhost/api/autopilot/watchdog?timeoutMinutes=${timeoutMinutes}`
    : 'http://localhost/api/autopilot/watchdog'
  return new Request(url, { method: 'POST' })
}

// ── Tests ─────────────────────────────────────────────────────────────���───────

describe('POST /api/autopilot/watchdog', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns empty reaped list when no running delegations', async () => {
    listByStatus.mockResolvedValueOnce([])
    const { POST } = await import('./route')
    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
    expect(data.reaped).toHaveLength(0)
    expect(data.count).toBe(0)
  })

  it('reaps stuck delegation (silent > timeout)', async () => {
    const stuck = makeRunning('del-stuck', 20)
    listByStatus.mockResolvedValueOnce([stuck])
    update.mockResolvedValueOnce({ ...stuck, status: 'failed' })

    const { POST } = await import('./route')
    const res = await POST(makeRequest(10))
    const data = await res.json()

    expect(data.count).toBe(1)
    expect(data.reaped[0].delegationId).toBe('del-stuck')
    expect(data.reaped[0].silentMinutes).toBeGreaterThanOrEqual(10)
    expect(update).toHaveBeenCalledOnce()
    expect(update).toHaveBeenCalledWith(
      'del-stuck',
      expect.objectContaining({ status: 'failed' }),
    )
  })

  it('does not reap delegation that is within timeout', async () => {
    const fresh = makeRunning('del-fresh', 3)
    listByStatus.mockResolvedValueOnce([fresh])

    const { POST } = await import('./route')
    const res = await POST(makeRequest(10))
    const data = await res.json()

    expect(data.count).toBe(0)
    expect(update).not.toHaveBeenCalled()
  })

  it('respects custom timeoutMinutes query param', async () => {
    const almostStuck = makeRunning('del-almost', 25)
    listByStatus.mockResolvedValueOnce([almostStuck])
    update.mockResolvedValueOnce({ ...almostStuck, status: 'failed' })

    const { POST } = await import('./route')
    // timeout=20 min, delegation has been silent 25 min → should reap
    const res = await POST(makeRequest(20))
    const data = await res.json()
    expect(data.count).toBe(1)
  })

  it('includes timestamp in response', async () => {
    listByStatus.mockResolvedValueOnce([])
    const { POST } = await import('./route')
    const res = await POST(makeRequest())
    const data = await res.json()
    expect(typeof data.timestamp).toBe('string')
    expect(data.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}/)
  })
})
