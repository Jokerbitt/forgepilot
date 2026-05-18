import { describe, it, expect, vi, afterEach } from 'vitest'
import { checkOllamaHealth, checkAnthropicHealth } from './health'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

afterEach(() => {
  vi.resetAllMocks()
  delete process.env.ANTHROPIC_API_KEY
})

describe('checkOllamaHealth', () => {
  it('returns healthy with model list on success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ models: [{ name: 'llama3.2:3b' }, { name: 'bge-m3' }] }),
    })
    const result = await checkOllamaHealth('http://localhost:11434')
    expect(result.status).toBe('healthy')
    expect(result.availableModels).toContain('llama3.2:3b')
    expect(result.latencyMs).toBeGreaterThanOrEqual(0)
    expect(result.checkedAt).toBeTruthy()
  })

  it('returns degraded on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) })
    const result = await checkOllamaHealth('http://localhost:11434')
    expect(result.status).toBe('degraded')
    expect(result.error).toContain('503')
  })

  it('returns offline on fetch error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Connection refused'))
    const result = await checkOllamaHealth('http://localhost:11434')
    expect(result.status).toBe('offline')
    expect(result.error).toContain('Connection refused')
  })

  it('strips trailing slash from endpoint', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ models: [] }),
    })
    await checkOllamaHealth('http://localhost:11434/')
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:11434/api/tags',
      expect.any(Object),
    )
  })
})

describe('checkAnthropicHealth', () => {
  it('returns healthy when ANTHROPIC_API_KEY is set', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test-key'
    const result = await checkAnthropicHealth()
    expect(result.status).toBe('healthy')
    expect(result.provider).toBe('anthropic')
  })

  it('returns offline when no API key', async () => {
    const result = await checkAnthropicHealth()
    expect(result.status).toBe('offline')
    expect(result.error).toContain('not configured')
  })
})
