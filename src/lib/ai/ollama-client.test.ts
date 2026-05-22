import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import {
  isOllamaRunning,
  getAvailableOllamaModels,
  generateWithOllama,
  PREFERRED_MODELS,
} from './ollama-client'

// Mock the readStoredApiKeys so tests don't need the config file
vi.mock('@/lib/connectors/config', () => ({
  readStoredApiKeys: () => ({}),
}))

afterEach(() => {
  vi.restoreAllMocks()
})

describe('PREFERRED_MODELS', () => {
  it('includes llama3.2 and mistral', () => {
    expect(PREFERRED_MODELS).toContain('llama3.2')
    expect(PREFERRED_MODELS).toContain('mistral')
  })
})

describe('isOllamaRunning', () => {
  it('returns true when /api/tags responds ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
    const result = await isOllamaRunning()
    expect(result).toBe(true)
  })

  it('returns false when fetch throws (network error)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')))
    const result = await isOllamaRunning()
    expect(result).toBe(false)
  })

  it('returns false when response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    const result = await isOllamaRunning()
    expect(result).toBe(false)
  })

  it('returns false on timeout (AbortError)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(Object.assign(new Error('Timeout'), { name: 'AbortError' }))
    )
    const result = await isOllamaRunning()
    expect(result).toBe(false)
  })
})

describe('getAvailableOllamaModels', () => {
  it('returns model name list when Ollama responds', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          models: [{ name: 'llama3.2' }, { name: 'mistral' }],
        }),
      })
    )
    const result = await getAvailableOllamaModels()
    expect(result).toEqual(['llama3.2', 'mistral'])
  })

  it('returns empty array when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')))
    const result = await getAvailableOllamaModels()
    expect(result).toEqual([])
  })

  it('returns empty array when response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    const result = await getAvailableOllamaModels()
    expect(result).toEqual([])
  })

  it('returns empty array when models field is missing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({}),
      })
    )
    const result = await getAvailableOllamaModels()
    expect(result).toEqual([])
  })
})

describe('generateWithOllama', () => {
  it('returns generated text on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn()
        // First call: /api/tags to get available models
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ models: [{ name: 'llama3.2' }] }),
        })
        // Second call: /api/generate
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ response: 'Hello world' }),
        })
    )
    const result = await generateWithOllama('Say hello')
    expect(result).toBe('Hello world')
  })

  it('returns empty string when Ollama is not running', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')))
    const result = await generateWithOllama('test')
    expect(result).toBe('')
  })

  it('returns empty string when no models are installed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ models: [] }),
      })
    )
    const result = await generateWithOllama('test')
    expect(result).toBe('')
  })

  it('returns empty string when generate call returns error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ models: [{ name: 'llama3.2' }] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ error: 'model not found' }),
        })
    )
    const result = await generateWithOllama('test')
    expect(result).toBe('')
  })

  it('uses the provided model directly without checking available models', async () => {
    const fetchMock = vi.fn()
      // Only one call to /api/generate, no /api/tags lookup
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ response: 'direct result' }),
      })
    vi.stubGlobal('fetch', fetchMock)

    const result = await generateWithOllama('test', 'mistral')
    expect(result).toBe('direct result')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('prefers llama3.2 over llama3 when both are available', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          models: [{ name: 'llama3' }, { name: 'llama3.2' }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ response: 'ok' }),
      })
    vi.stubGlobal('fetch', fetchMock)

    await generateWithOllama('test')

    const generateCall = fetchMock.mock.calls[1]
    const body = JSON.parse(generateCall[1].body as string) as { model: string }
    expect(body.model).toBe('llama3.2')
  })
})
