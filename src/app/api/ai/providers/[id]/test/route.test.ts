/**
 * @vitest-environment node
 *
 * Tests for POST /api/ai/providers/[id]/test
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AIProviderConfig } from '@/lib/ai/providers/types'

// ── Config store mock ──────────────────────────────────────────────────────────

const getAllProviderConfigs = vi.fn<[], AIProviderConfig[]>()

vi.mock('@/lib/ai/providers/config-store', () => ({
  getAllProviderConfigs,
  getEnabledProviderConfigs: vi.fn(() => []),
}))

// ── Registry mock ──────────────────────────────────────────────────────────────

const isAvailable = vi.fn<[string, string?], Promise<boolean>>()
const getProviderInstance = vi.fn<[string], { isAvailable: typeof isAvailable } | null>()

vi.mock('@/lib/ai/providers/registry', () => ({ getProviderInstance }))

// ── API keys mock ──────────────────────────────────────────────────────────────

vi.mock('@/lib/connectors/config', () => ({ readStoredApiKeys: vi.fn(() => ({})) }))

// ── Fixture ────────────────────────────────────────────────────────────────────

function makeProvider(overrides: Partial<AIProviderConfig> = {}): AIProviderConfig {
  return {
    id: 'anthropic',
    name: 'Anthropic',
    type: 'anthropic',
    enabled: true,
    models: [{ id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', purpose: 'coding' as const }],
    apiKeyRef: 'ANTHROPIC_API_KEY',
    isBuiltIn: true,
    dataResidency: 'us' as const,
    ...overrides,
  }
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/ai/providers/[id]/test', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 404 when provider config not found', async () => {
    getAllProviderConfigs.mockReturnValueOnce([])
    const { POST } = await import('./route')
    const res = await POST(new Request('http://localhost', { method: 'POST' }), makeParams('missing'))
    expect(res.status).toBe(404)
    expect(getProviderInstance).not.toHaveBeenCalled()
  })

  it('returns 404 when provider not registered in registry', async () => {
    getAllProviderConfigs.mockReturnValueOnce([makeProvider()])
    getProviderInstance.mockReturnValueOnce(null)
    const { POST } = await import('./route')
    const res = await POST(new Request('http://localhost', { method: 'POST' }), makeParams('anthropic'))
    expect(res.status).toBe(404)
  })

  it('returns ok:true with latency when provider is available', async () => {
    getAllProviderConfigs.mockReturnValueOnce([makeProvider()])
    isAvailable.mockResolvedValueOnce(true)
    getProviderInstance.mockReturnValueOnce({ isAvailable })
    const { POST } = await import('./route')
    const res = await POST(new Request('http://localhost', { method: 'POST' }), makeParams('anthropic'))
    expect(res.status).toBe(200)
    const body = await res.json() as { ok: boolean; latencyMs: number; providerId: string; providerName: string }
    expect(body.ok).toBe(true)
    expect(body.providerId).toBe('anthropic')
    expect(body.providerName).toBe('Anthropic')
    expect(typeof body.latencyMs).toBe('number')
  })

  it('returns ok:false when provider is unavailable', async () => {
    getAllProviderConfigs.mockReturnValueOnce([makeProvider()])
    isAvailable.mockResolvedValueOnce(false)
    getProviderInstance.mockReturnValueOnce({ isAvailable })
    const { POST } = await import('./route')
    const res = await POST(new Request('http://localhost', { method: 'POST' }), makeParams('anthropic'))
    expect(res.status).toBe(200)
    const body = await res.json() as { ok: boolean }
    expect(body.ok).toBe(false)
  })
})
