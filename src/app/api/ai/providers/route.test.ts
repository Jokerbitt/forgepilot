/**
 * @vitest-environment node
 *
 * Tests for GET / POST / DELETE /api/ai/providers
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AIProviderConfig, AIModelSelection } from '@/lib/ai/providers/types'

// ── Config store mocks ─────────────────────────────────────────────────────────

const getAllProviderConfigs = vi.fn<() => AIProviderConfig[]>()
const getModelSelection    = vi.fn<() => AIModelSelection>()
const saveModelSelection   = vi.fn<(a: AIModelSelection) => void>()
const upsertProviderConfig = vi.fn<(a: Partial<AIProviderConfig> & { id: string }) => void>()
const deleteCustomProvider = vi.fn<(a: string) => void>()

vi.mock('@/lib/ai/providers/config-store', () => ({
  getAllProviderConfigs,
  getModelSelection,
  saveModelSelection,
  upsertProviderConfig,
  deleteCustomProvider,
  getEnabledProviderConfigs: vi.fn(() => []),
}))

// ── Registry + API keys mock ───────────────────────────────────────────────────

vi.mock('@/lib/ai/providers/registry', () => ({ getProviderInstance: vi.fn(() => null) }))
vi.mock('@/lib/connectors/config', () => ({ readStoredApiKeys: vi.fn(() => ({})) }))

// ── Fixtures ───────────────────────────────────────────────────────────────────

function makeProvider(overrides: Partial<AIProviderConfig> = {}): AIProviderConfig {
  return {
    id: 'anthropic',
    name: 'Anthropic',
    type: 'anthropic',
    enabled: true,
    models: [{ id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', purpose: 'coding' as const }],
    apiKeyRef: 'ANTHROPIC_API_KEY',
    isBuiltIn: true,
    dataResidency: 'us' as const,
    ...overrides,
  }
}

function makeSelection(): AIModelSelection {
  return {
    fastProvider: 'anthropic',
    fastModel: 'claude-haiku-4-5-20251001',
    codingProvider: 'anthropic',
    codingModel: 'claude-sonnet-4-6',
  }
}

function makeGetRequest() {
  const { NextRequest } = require('next/server') as typeof import('next/server')
  return new NextRequest('http://localhost/api/ai/providers')
}

function makePostRequest(body: unknown) {
  const { NextRequest } = require('next/server') as typeof import('next/server')
  return new NextRequest('http://localhost/api/ai/providers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeDeleteRequest(id: string) {
  const { NextRequest } = require('next/server') as typeof import('next/server')
  return new NextRequest(`http://localhost/api/ai/providers?id=${id}`, { method: 'DELETE' })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/ai/providers', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns providers list and selection', async () => {
    getAllProviderConfigs.mockReturnValueOnce([makeProvider()])
    getModelSelection.mockReturnValueOnce(makeSelection())
    const { GET } = await import('./route')
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json() as { providers: AIProviderConfig[]; selection: AIModelSelection }
    expect(body.providers).toHaveLength(1)
    expect(body.providers[0].id).toBe('anthropic')
    expect(body.selection.fastProvider).toBe('anthropic')
  })

  it('annotates providers with hasApiKey=false when apiKeyRef has no value', async () => {
    getAllProviderConfigs.mockReturnValueOnce([makeProvider({ apiKeyRef: 'MISSING_KEY' })])
    getModelSelection.mockReturnValueOnce(makeSelection())
    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json() as { providers: Array<{ hasApiKey: boolean }> }
    expect(body.providers[0].hasApiKey).toBe(false)
  })

  it('annotates providers with hasApiKey=true when no apiKeyRef (local provider)', async () => {
    getAllProviderConfigs.mockReturnValueOnce([makeProvider({ apiKeyRef: undefined, type: 'ollama' })])
    getModelSelection.mockReturnValueOnce(makeSelection())
    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json() as { providers: Array<{ hasApiKey: boolean }> }
    expect(body.providers[0].hasApiKey).toBe(true)
  })
})

describe('POST /api/ai/providers', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('upserts provider config when provider field is present', async () => {
    const { POST } = await import('./route')
    const res = await POST(makePostRequest({ provider: { id: 'openai', enabled: true } }))
    expect(res.status).toBe(200)
    const body = await res.json() as { ok: boolean }
    expect(body.ok).toBe(true)
    expect(upsertProviderConfig).toHaveBeenCalledWith({ id: 'openai', enabled: true })
  })

  it('saves model selection when selection field is present', async () => {
    const sel = makeSelection()
    const { POST } = await import('./route')
    const res = await POST(makePostRequest({ selection: sel }))
    expect(res.status).toBe(200)
    expect(saveModelSelection).toHaveBeenCalledWith(sel)
  })

  it('handles both provider and selection in one request', async () => {
    const { POST } = await import('./route')
    const res = await POST(
      makePostRequest({
        provider: { id: 'openai', enabled: false },
        selection: makeSelection(),
      }),
    )
    expect(res.status).toBe(200)
    expect(upsertProviderConfig).toHaveBeenCalledOnce()
    expect(saveModelSelection).toHaveBeenCalledOnce()
  })

  it('returns 200 for empty body (no-op)', async () => {
    const { POST } = await import('./route')
    const res = await POST(makePostRequest({}))
    expect(res.status).toBe(200)
    expect(upsertProviderConfig).not.toHaveBeenCalled()
    expect(saveModelSelection).not.toHaveBeenCalled()
  })
})

describe('DELETE /api/ai/providers', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 400 when id param is missing', async () => {
    const { NextRequest } = require('next/server') as typeof import('next/server')
    const { DELETE } = await import('./route')
    const res = await DELETE(new NextRequest('http://localhost/api/ai/providers', { method: 'DELETE' }))
    expect(res.status).toBe(400)
    expect(deleteCustomProvider).not.toHaveBeenCalled()
  })

  it('deletes provider by id and returns ok', async () => {
    const { DELETE } = await import('./route')
    const res = await DELETE(makeDeleteRequest('custom-llm'))
    expect(res.status).toBe(200)
    const body = await res.json() as { ok: boolean }
    expect(body.ok).toBe(true)
    expect(deleteCustomProvider).toHaveBeenCalledWith('custom-llm')
  })
})
