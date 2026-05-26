/**
 * @vitest-environment node
 *
 * Tests for GET /api/smoke-test (M23.1)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Delegation } from '@/lib/models/delegation'

const mockListByStatus = vi.fn(async () => [] as Delegation[])

vi.mock('@/lib/repositories/delegationRepository', () => ({
  SINGLE_TENANT_USER_ID: 'user-1',
  createDelegationRepository: vi.fn(() => ({
    listByStatus: mockListByStatus,
  })),
}))

vi.mock('@/lib/connectors/config', () => ({
  readConnectorConfigs: vi.fn(() => ({
    linear: { apiKey: 'test-key' },
    github: undefined,
  })),
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockListByStatus.mockResolvedValue([])
})

describe('GET /api/smoke-test', () => {
  it('returns 200 and ok=true when all checks pass', async () => {
    const { GET } = await import('./route')
    const res = await GET()

    expect(res.status).toBe(200)
    const body = await res.json() as { ok: boolean; summary: string; checks: Array<{ name: string; status: string }> }
    expect(body.ok).toBe(true)
    expect(body.summary).toContain('OK')
  })

  it('includes delegations, connectors, and environment checks', async () => {
    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json() as { checks: Array<{ name: string }> }

    const names = body.checks.map(c => c.name)
    expect(names).toContain('delegations')
    expect(names).toContain('connectors')
    expect(names).toContain('environment')
  })

  it('includes timestamp in response', async () => {
    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json() as { timestamp: string }

    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('returns ok=false and 503 when delegations check fails', async () => {
    mockListByStatus.mockRejectedValueOnce(new Error('DB unreachable'))

    const { GET } = await import('./route')
    const res = await GET()

    expect(res.status).toBe(503)
    const body = await res.json() as { ok: boolean; summary: string; checks: Array<{ name: string; status: string; detail?: string }> }
    expect(body.ok).toBe(false)
    expect(body.summary).toContain('FAIL')

    const delCheck = body.checks.find(c => c.name === 'delegations')
    expect(delCheck?.status).toBe('error')
    expect(delCheck?.detail).toContain('DB unreachable')
  })

  it('connectors check is warn (not error) even when readConnectorConfigs throws', async () => {
    const { readConnectorConfigs } = await import('@/lib/connectors/config')
    vi.mocked(readConnectorConfigs).mockImplementationOnce(() => { throw new Error('config missing') })

    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json() as { ok: boolean; checks: Array<{ name: string; status: string }> }

    const connCheck = body.checks.find(c => c.name === 'connectors')
    expect(connCheck?.status).toBe('warn')
    // ok is still true because warn does not fail the check
    expect(body.ok).toBe(true)
  })

  it('connectors check detail shows count of configured connectors', async () => {
    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json() as { checks: Array<{ name: string; detail?: string }> }

    const connCheck = body.checks.find(c => c.name === 'connectors')
    expect(connCheck?.detail).toContain('1 configured')
  })

  it('summary is WARN when any check is warn but none are error', async () => {
    const { readConnectorConfigs } = await import('@/lib/connectors/config')
    vi.mocked(readConnectorConfigs).mockImplementationOnce(() => { throw new Error('config missing') })

    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json() as { ok: boolean; summary: string }

    expect(body.ok).toBe(true)
    expect(body.summary).toContain('WARN')
  })
})
