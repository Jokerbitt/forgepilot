/**
 * Tests for GET/POST /api/ai/providers/health — M156
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ProviderHealthReport } from '@/lib/ai/providers/health-monitor'

const mockReport: ProviderHealthReport = {
  checkedAt: '2026-05-21T08:00:00.000Z',
  providers: [
    {
      providerId: 'anthropic',
      providerName: 'Anthropic',
      status: 'healthy',
      latencyMs: 120,
      checkedAt: '2026-05-21T08:00:00.000Z',
      failStreak: 0,
    },
    {
      providerId: 'ollama',
      providerName: 'Ollama',
      status: 'unavailable',
      checkedAt: '2026-05-21T08:00:00.000Z',
      failStreak: 3,
      error: 'Connection refused',
    },
  ],
  summary: { total: 2, healthy: 1, degraded: 0, unavailable: 1, unconfigured: 0 },
}

const { mockGetCached, mockRunHealthCheck } = vi.hoisted(() => ({
  mockGetCached: vi.fn(() => null as ProviderHealthReport | null),
  mockRunHealthCheck: vi.fn(() => Promise.resolve(null as unknown as ProviderHealthReport)),
}))

vi.mock('@/lib/ai/providers/health-monitor', () => ({
  getCachedHealthReport: mockGetCached,
  runHealthCheck: mockRunHealthCheck,
}))

import { GET, POST } from './route'

beforeEach(() => {
  vi.clearAllMocks()
  mockGetCached.mockReturnValue(null)
  mockRunHealthCheck.mockResolvedValue(mockReport)
})

describe('GET /api/ai/providers/health', () => {
  it('returns empty report when cache is empty', async () => {
    mockGetCached.mockReturnValue(null)
    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json() as { checkedAt: string | null; providers: unknown[]; summary: unknown }
    expect(json.checkedAt).toBeNull()
    expect(json.providers).toEqual([])
  })

  it('returns cached report when available', async () => {
    mockGetCached.mockReturnValue(mockReport)
    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json() as ProviderHealthReport
    expect(json.checkedAt).toBe('2026-05-21T08:00:00.000Z')
    expect(json.providers).toHaveLength(2)
    expect(json.summary.healthy).toBe(1)
    expect(json.summary.unavailable).toBe(1)
  })

  it('returns provider with correct fields', async () => {
    mockGetCached.mockReturnValue(mockReport)
    const res = await GET()
    const json = await res.json() as ProviderHealthReport
    const anthropic = json.providers.find(p => p.providerId === 'anthropic')
    expect(anthropic).toBeDefined()
    expect(anthropic?.status).toBe('healthy')
    expect(anthropic?.latencyMs).toBe(120)
    expect(anthropic?.failStreak).toBe(0)
  })

  it('includes failStreak info for unavailable provider', async () => {
    mockGetCached.mockReturnValue(mockReport)
    const res = await GET()
    const json = await res.json() as ProviderHealthReport
    const ollama = json.providers.find(p => p.providerId === 'ollama')
    expect(ollama?.status).toBe('unavailable')
    expect(ollama?.failStreak).toBe(3)
    expect(ollama?.error).toBe('Connection refused')
  })
})

describe('POST /api/ai/providers/health', () => {
  it('triggers a fresh health check and returns 200', async () => {
    const res = await POST()
    expect(res.status).toBe(200)
    expect(mockRunHealthCheck).toHaveBeenCalledOnce()
  })

  it('returns the fresh health report', async () => {
    const res = await POST()
    const json = await res.json() as ProviderHealthReport
    expect(json.checkedAt).toBe('2026-05-21T08:00:00.000Z')
    expect(json.providers).toHaveLength(2)
  })

  it('returns 500 when health check throws', async () => {
    mockRunHealthCheck.mockRejectedValue(new Error('Network error'))
    const res = await POST()
    expect(res.status).toBe(500)
    const json = await res.json() as { error: string; }
    expect(json.error).toBe('Health check failed')
  })
})
