import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/github/pr-status', () => ({
  fetchPRStatus: vi.fn(),
}))
vi.mock('@/lib/logger', () => ({
  apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/github/pr-status', () => {
  it('returns PR status for a valid URL', async () => {
    const { fetchPRStatus } = await import('@/lib/github/pr-status')
    vi.mocked(fetchPRStatus).mockResolvedValue({
      url: 'https://github.com/org/repo/pull/42',
      number: 42,
      state: 'open',
      title: 'Add auth tests',
      checks: [],
    } as unknown as Awaited<ReturnType<typeof fetchPRStatus>>)

    const { GET } = await import('./route')
    const res = await GET(new NextRequest('http://localhost/api/github/pr-status?url=https://github.com/org/repo/pull/42'))
    const body = await res.json() as { number: number; state: string }

    expect(res.status).toBe(200)
    expect(body.number).toBe(42)
    expect(body.state).toBe('open')
  })

  it('returns 400 when url parameter is missing', async () => {
    const { GET } = await import('./route')
    const res = await GET(new NextRequest('http://localhost/api/github/pr-status'))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid PR URL', async () => {
    const { fetchPRStatus } = await import('@/lib/github/pr-status')
    vi.mocked(fetchPRStatus).mockResolvedValue({ error: 'Invalid PR URL' } as unknown as Awaited<ReturnType<typeof fetchPRStatus>>)

    const { GET } = await import('./route')
    const res = await GET(new NextRequest('http://localhost/api/github/pr-status?url=not-a-pr-url'))
    expect(res.status).toBe(400)
  })

  it('returns 502 when GitHub API throws', async () => {
    const { fetchPRStatus } = await import('@/lib/github/pr-status')
    vi.mocked(fetchPRStatus).mockRejectedValue(new Error('GitHub API error'))

    const { GET } = await import('./route')
    const res = await GET(new NextRequest('http://localhost/api/github/pr-status?url=https://github.com/org/repo/pull/1'))
    expect(res.status).toBe(502)
  })
})
