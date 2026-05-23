import { describe, it, expect, vi, beforeEach } from 'vitest'

beforeEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe('GET /api/ollama', () => {
  it('returns models and active models when Ollama is running', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ models: [{ name: 'llama3', size: 4_000_000_000 }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ models: [{ name: 'llama3', size_vram: 3_000_000_000 }] }) }),
    )

    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json() as { reachable: boolean; totalModels: number; models: unknown[]; activeModels: unknown[] }

    expect(res.status).toBe(200)
    expect(body.reachable).toBe(true)
    expect(body.totalModels).toBe(1)
    expect(body.models).toHaveLength(1)
  })

  it('returns reachable=false when Ollama is offline', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')))

    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json() as { reachable: boolean; models: unknown[] }

    expect(res.status).toBe(200)
    expect(body.reachable).toBe(false)
    expect(body.models).toHaveLength(0)
  })
})
