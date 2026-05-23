import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/ai/providers/config-store', () => ({
  getModelSelection: vi.fn(),
  saveModelSelection: vi.fn(),
  getAllProviderConfigs: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/ai/model-selection', () => {
  it('returns current model selection', async () => {
    const { getModelSelection } = await import('@/lib/ai/providers/config-store')
    vi.mocked(getModelSelection).mockReturnValue({
      fastProvider: 'anthropic',
      fastModel: 'claude-haiku-4-5',
      codingProvider: 'anthropic',
      codingModel: 'claude-sonnet-4-6',
    })

    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json() as { fastProvider: string; codingModel: string }

    expect(res.status).toBe(200)
    expect(body.fastProvider).toBe('anthropic')
    expect(body.codingModel).toBe('claude-sonnet-4-6')
  })
})

describe('POST /api/ai/model-selection', () => {
  it('saves and returns updated selection', async () => {
    const { getAllProviderConfigs, saveModelSelection } = await import('@/lib/ai/providers/config-store')
    vi.mocked(getAllProviderConfigs).mockReturnValue([
      { id: 'anthropic', name: 'Anthropic', models: [{ id: 'claude-haiku-4-5' }] },
    ] as ReturnType<typeof getAllProviderConfigs>)
    vi.mocked(saveModelSelection).mockReturnValue(undefined)

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/ai/model-selection', {
      method: 'POST',
      body: JSON.stringify({ fastProvider: 'anthropic', fastModel: 'claude-haiku-4-5' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)

    expect(res.status).toBe(200)
  })

  it('returns 400 when provider not found', async () => {
    const { getAllProviderConfigs } = await import('@/lib/ai/providers/config-store')
    vi.mocked(getAllProviderConfigs).mockReturnValue([])

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/ai/model-selection', {
      method: 'POST',
      body: JSON.stringify({ fastProvider: 'unknown-provider', fastModel: 'some-model' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
