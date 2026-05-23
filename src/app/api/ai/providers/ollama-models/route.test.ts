import { describe, it, expect, vi, beforeEach } from 'vitest'

beforeEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe('GET /api/ai/providers/ollama-models', () => {
  it('returns models when Ollama is running', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        models: [
          { name: 'llama3:latest', size: 4_000_000, modified_at: '2024-01-01' },
          { name: 'mistral:7b', size: 7_000_000, modified_at: '2024-01-02' },
        ],
      }),
    }))

    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json() as { models: { id: string; name: string }[] }

    expect(res.status).toBe(200)
    expect(body.models).toHaveLength(2)
    expect(body.models[0].id).toBe('llama3:latest')
  })

  it('returns empty models when Ollama returns non-ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({}),
    }))

    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json() as { models: unknown[]; error?: string }

    expect(res.status).toBe(200)
    expect(body.models).toHaveLength(0)
    expect(body.error).toBe('Ollama not running')
  })

  it('returns empty models when fetch throws (Ollama offline)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')))

    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json() as { models: unknown[]; error?: string }

    expect(res.status).toBe(200)
    expect(body.models).toHaveLength(0)
    expect(body.error).toBe('Ollama not running')
  })
})
