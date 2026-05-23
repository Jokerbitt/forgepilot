import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/model-router/health', () => ({
  checkOllamaHealth: vi.fn(),
  checkAnthropicHealth: vi.fn(),
}))
vi.mock('@/lib/connectors/config', () => ({
  readStoredApiKeys: vi.fn().mockReturnValue({}),
}))
vi.mock('@/lib/nba-engine/nba-config', () => ({
  getNBAConfig: vi.fn().mockReturnValue({ aiProvider: 'anthropic' }),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/model-router/health', () => {
  it('returns health of both providers', async () => {
    const { checkOllamaHealth, checkAnthropicHealth } = await import('@/lib/model-router/health')
    vi.mocked(checkOllamaHealth).mockResolvedValue({ ok: false, detail: 'not running' } as unknown as Awaited<ReturnType<typeof checkOllamaHealth>>)
    vi.mocked(checkAnthropicHealth).mockResolvedValue({ ok: true, detail: 'API key set' } as unknown as Awaited<ReturnType<typeof checkAnthropicHealth>>)

    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json() as { preferred: string; providers: { ollama: { ok: boolean }; anthropic: { ok: boolean } } }

    expect(res.status).toBe(200)
    expect(body.preferred).toBe('anthropic')
    expect(body.providers.anthropic.ok).toBe(true)
    expect(body.providers.ollama.ok).toBe(false)
  })
})
