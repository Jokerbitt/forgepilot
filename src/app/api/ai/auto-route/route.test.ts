/**
 * @vitest-environment node
 *
 * Tests for GET + POST /api/ai/auto-route
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { ResolvedProvider } from '@/lib/ai/auto-router'

const mockSelectBestProvider = vi.fn()
const mockDetectCLIProviders = vi.fn()

vi.mock('@/lib/ai/auto-router', () => ({
  selectBestProvider: (...args: unknown[]) => mockSelectBestProvider(...args),
  detectCLIProviders: () => mockDetectCLIProviders(),
  DEFAULT_ROUTER_PREFS: { preferLocal: true, allowPaidAPIs: true },
}))

const mockRecommendation: ResolvedProvider = {
  mode: 'anthropic',
  providerId: 'anthropic',
  model: 'claude-3-5-haiku-20241022',
  isFree: false,
  isLocal: false,
  reason: 'Anthropic API key configured',
}

const mockCLIStatus = { claude: false, codex: false }

beforeEach(() => {
  vi.clearAllMocks()
  mockSelectBestProvider.mockReturnValue(mockRecommendation)
  mockDetectCLIProviders.mockReturnValue(mockCLIStatus)
})

describe('GET /api/ai/auto-route', () => {
  it('returns recommendation and cliStatus', async () => {
    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost/api/ai/auto-route?complexity=simple')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.complexity).toBe('simple')
    expect(body.recommendation).toMatchObject({ providerId: 'anthropic' })
    expect(body.cliStatus).toEqual(mockCLIStatus)
  })

  it('defaults complexity to "simple" when param missing', async () => {
    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost/api/ai/auto-route')
    await GET(req)

    expect(mockSelectBestProvider).toHaveBeenCalledWith('simple', expect.any(Object))
  })

  it('passes coding complexity to selectBestProvider', async () => {
    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost/api/ai/auto-route?complexity=coding')
    await GET(req)

    expect(mockSelectBestProvider).toHaveBeenCalledWith('coding', expect.any(Object))
  })

  it('passes preferLocal=false when query param is false', async () => {
    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost/api/ai/auto-route?preferLocal=false')
    await GET(req)

    expect(mockSelectBestProvider).toHaveBeenCalledWith('simple', expect.objectContaining({ preferLocal: false }))
  })

  it('defaults preferLocal to true', async () => {
    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost/api/ai/auto-route')
    await GET(req)

    expect(mockSelectBestProvider).toHaveBeenCalledWith('simple', expect.objectContaining({ preferLocal: true }))
  })
})

describe('POST /api/ai/auto-route', () => {
  it('returns recommendation from POST body', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/ai/auto-route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ complexity: 'complex', preferLocal: false, allowPaidAPIs: true }),
    })
    const res = await POST(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.complexity).toBe('complex')
    expect(mockSelectBestProvider).toHaveBeenCalledWith('complex', { preferLocal: false, allowPaidAPIs: true })
  })

  it('uses default prefs when POST body is empty', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/ai/auto-route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    await POST(req)

    expect(mockSelectBestProvider).toHaveBeenCalledWith(
      'simple',
      expect.objectContaining({ preferLocal: true, allowPaidAPIs: true }),
    )
  })
})
