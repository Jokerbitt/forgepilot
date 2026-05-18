import { describe, it, expect, vi, beforeEach } from 'vitest'

global.fetch = vi.fn()

describe('GET /api/local-ai/status', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    delete process.env.ANTHROPIC_API_KEY
    delete process.env.DEFAULT_PRIVACY_MODE
  })

  it('returns healthy ollama when endpoint responds', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ models: [{ name: 'llama3.2:3b' }, { name: 'bge-m3' }] }),
    } as Response)

    const { GET } = await import('./route')
    const res = await GET()
    const data = await res.json()

    expect(data.ollama.status).toBe('healthy')
    expect(data.ollama.models).toContain('llama3.2:3b')
    expect(data.ollama.detail).toContain('2 Modelle')
  })

  it('returns offline ollama when fetch throws', async () => {
    vi.mocked(global.fetch).mockRejectedValueOnce(new Error('ECONNREFUSED'))

    const { GET } = await import('./route')
    const res = await GET()
    const data = await res.json()

    expect(data.ollama.status).toBe('offline')
  })

  it('returns offline anthropic when no api key', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ models: [] }),
    } as Response)

    const { GET } = await import('./route')
    const res = await GET()
    const data = await res.json()

    expect(data.anthropic.status).toBe('offline')
  })

  it('returns healthy anthropic when api key present', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test-key'
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ models: [] }),
    } as Response)

    const { GET } = await import('./route')
    const res = await GET()
    const data = await res.json()

    expect(data.anthropic.status).toBe('healthy')
  })

  it('returns default privacy mode hybrid when env not set', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ models: [] }),
    } as Response)

    const { GET } = await import('./route')
    const res = await GET()
    const data = await res.json()

    expect(data.defaultPrivacyMode).toBe('hybrid')
  })

  it('result includes checkedAt timestamp and claudeCode status', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ models: [] }),
    } as Response)

    const { GET } = await import('./route')
    const res = await GET()
    const data = await res.json()

    expect(data.checkedAt).toBeTruthy()
    expect(data.claudeCode.status).toBe('healthy')
  })
})
