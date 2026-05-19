import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { OllamaModelsResponse, OllamaModelInfo } from '@/app/api/ai/providers/ollama-models/route'

// Helper: simulate the core logic of the API route handler
async function fetchOllamaModels(fetchFn: typeof fetch): Promise<OllamaModelsResponse> {
  try {
    const response = await fetchFn('http://localhost:11434/api/tags', {
      signal: AbortSignal.timeout(3000),
    })

    if (!response.ok) {
      return { models: [], error: 'Ollama not running' }
    }

    const data = await response.json() as { models: Array<{ name: string; size: number; modified_at: string }> }

    const models: OllamaModelInfo[] = (data.models ?? []).map((m) => ({
      id: m.name,
      name: m.name,
      size: m.size,
      modifiedAt: m.modified_at,
    }))

    return { models }
  } catch {
    return { models: [], error: 'Ollama not running' }
  }
}

describe('Ollama Auto-Detect', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns correct model list when Ollama is running', async () => {
    const mockModels = [
      { name: 'llama3:8b', size: 4_661_211_136, modified_at: '2024-01-15T10:00:00Z' },
      { name: 'mistral:7b', size: 3_825_819_648, modified_at: '2024-01-14T08:30:00Z' },
    ]

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ models: mockModels }),
    })

    const result = await fetchOllamaModels(mockFetch as unknown as typeof fetch)

    expect(result.error).toBeUndefined()
    expect(result.models).toHaveLength(2)
    expect(result.models[0]).toEqual({
      id: 'llama3:8b',
      name: 'llama3:8b',
      size: 4_661_211_136,
      modifiedAt: '2024-01-15T10:00:00Z',
    })
    expect(result.models[1]).toEqual({
      id: 'mistral:7b',
      name: 'mistral:7b',
      size: 3_825_819_648,
      modifiedAt: '2024-01-14T08:30:00Z',
    })
  })

  it('returns empty list with error message when Ollama is not reachable (connection refused)', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:11434'))

    const result = await fetchOllamaModels(mockFetch as unknown as typeof fetch)

    expect(result.models).toEqual([])
    expect(result.error).toBe('Ollama not running')
  })

  it('returns empty list with error message when Ollama returns non-ok status', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
    })

    const result = await fetchOllamaModels(mockFetch as unknown as typeof fetch)

    expect(result.models).toEqual([])
    expect(result.error).toBe('Ollama not running')
  })

  it('response shape is correctly typed — models array has required fields', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        models: [{ name: 'phi3:mini', size: 2_176_057_856, modified_at: '2024-02-01T12:00:00Z' }],
      }),
    })

    const result = await fetchOllamaModels(mockFetch as unknown as typeof fetch)

    // Type-level verification: result must conform to OllamaModelsResponse
    const typed: OllamaModelsResponse = result
    expect(typed).toBeDefined()

    const model = typed.models[0]
    expect(typeof model.id).toBe('string')
    expect(typeof model.name).toBe('string')
    expect(typeof model.size).toBe('number')
    expect(typeof model.modifiedAt).toBe('string')
  })

  it('returns empty models array (not null/undefined) when Ollama returns empty list', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ models: [] }),
    })

    const result = await fetchOllamaModels(mockFetch as unknown as typeof fetch)

    expect(Array.isArray(result.models)).toBe(true)
    expect(result.models).toHaveLength(0)
    expect(result.error).toBeUndefined()
  })
})
