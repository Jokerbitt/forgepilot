import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('@/lib/ai/providers/config-store', () => ({
  getAllProviderConfigs: vi.fn(() => [
    { id: 'test-provider', name: 'Test Provider', apiKeyRef: 'TEST_API_KEY', baseUrl: 'https://api.test.com/v1', models: [{ id: 'model-1', name: 'Model 1', purpose: 'fast' }], enabled: true, isBuiltIn: false, dataResidency: 'us', type: 'openai-compatible' },
  ]),
}))

vi.mock('@/lib/ai/providers/registry', () => ({
  getProviderInstance: vi.fn((id: string) => {
    if (id === 'test-provider') {
      return {
        id: 'test-provider',
        generateText: vi.fn(() => Promise.resolve({
          text: 'Hello from test provider!',
          providerId: 'test-provider',
          model: 'model-1',
          inputTokens: 10,
          outputTokens: 6,
        })),
      }
    }
    return undefined
  }),
}))

vi.mock('@/lib/connectors/config', () => ({
  readStoredApiKeys: vi.fn(() => ({ TEST_API_KEY: 'test-key-123' })),
}))

vi.mock('@/lib/logger', () => ({
  aiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('@sentry/nextjs', () => ({
  startSpan: vi.fn((_opts: unknown, fn: () => unknown) => fn()),
  captureException: vi.fn(),
}))

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/ai/chat-test', () => {
  beforeEach(() => { vi.clearAllMocks() })

  async function callRoute(body: unknown) {
    const { POST } = await import('./route')
    const req = new Request('http://localhost/api/ai/chat-test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return POST(req)
  }

  it('returns 400 when body is missing required fields', async () => {
    const res = await callRoute({ providerId: 'test-provider' })
    expect(res.status).toBe(400)
    const data = await res.json() as { ok: boolean }
    expect(data.ok).toBe(false)
  })

  it('returns 404 when provider is not found', async () => {
    const res = await callRoute({ providerId: 'unknown', modelId: 'x', prompt: 'hello' })
    expect(res.status).toBe(404)
  })

  it('returns ok:true with text and latency on success', async () => {
    const res = await callRoute({ providerId: 'test-provider', modelId: 'model-1', prompt: 'Say hello' })
    expect(res.status).toBe(200)
    const data = await res.json() as { ok: boolean; text: string; latencyMs: number; providerName: string }
    expect(data.ok).toBe(true)
    expect(data.text).toBe('Hello from test provider!')
    expect(typeof data.latencyMs).toBe('number')
    expect(data.providerName).toBe('Test Provider')
  })

  it('returns ok:true with token counts', async () => {
    const res = await callRoute({ providerId: 'test-provider', modelId: 'model-1', prompt: 'Count tokens' })
    const data = await res.json() as { ok: boolean; inputTokens: number; outputTokens: number }
    expect(data.ok).toBe(true)
    expect(data.inputTokens).toBe(10)
    expect(data.outputTokens).toBe(6)
  })

  it('returns 502 when provider throws', async () => {
    const { getProviderInstance } = await import('@/lib/ai/providers/registry')
    vi.mocked(getProviderInstance).mockReturnValueOnce({
      id: 'test-provider',
      name: 'Test Provider',
      type: 'openai-compatible',
      supportsEmbeddings: false,
      generateText: vi.fn(() => Promise.reject(new Error('API timeout'))),
      isAvailable: vi.fn(() => Promise.resolve(false)),
    })
    const res = await callRoute({ providerId: 'test-provider', modelId: 'model-1', prompt: 'will fail' })
    expect(res.status).toBe(502)
    const data = await res.json() as { ok: boolean; error: string }
    expect(data.ok).toBe(false)
    expect(data.error).toContain('API timeout')
  })

  it('returns 400 for invalid JSON', async () => {
    const { POST } = await import('./route')
    const req = new Request('http://localhost/api/ai/chat-test', {
      method: 'POST',
      body: 'not-json',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('uses custom systemPrompt when provided', async () => {
    const { getProviderInstance } = await import('@/lib/ai/providers/registry')
    const generateText = vi.fn(() => Promise.resolve({
      text: 'Custom system response',
      providerId: 'test-provider',
      model: 'model-1',
      inputTokens: 5,
      outputTokens: 4,
    }))
    vi.mocked(getProviderInstance).mockReturnValueOnce({
      id: 'test-provider',
      name: 'Test Provider',
      type: 'openai-compatible',
      supportsEmbeddings: false,
      generateText,
      isAvailable: vi.fn(() => Promise.resolve(true)),
    })
    await callRoute({
      providerId: 'test-provider',
      modelId: 'model-1',
      prompt: 'test',
      systemPrompt: 'Du bist ein Experte.',
    })
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({ system: 'Du bist ein Experte.' }),
    )
  })
})
