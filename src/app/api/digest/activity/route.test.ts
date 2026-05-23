import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/digest/digest-builder', () => ({
  buildDigest: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/digest/activity', () => {
  it('returns daily digest by default', async () => {
    const { buildDigest } = await import('@/lib/digest/digest-builder')
    vi.mocked(buildDigest).mockReturnValue({
      stats: { totalNotifications: 3, completedDelegations: 1 },
      sections: [],
    } as unknown as ReturnType<typeof buildDigest>)

    const { GET } = await import('./route')
    const res = await GET(new NextRequest('http://localhost/api/digest/activity'))
    const body = await res.json() as { stats: { totalNotifications: number } }

    expect(res.status).toBe(200)
    expect(body.stats.totalNotifications).toBe(3)
    expect(vi.mocked(buildDigest)).toHaveBeenCalledWith('daily')
  })

  it('accepts weekly period param', async () => {
    const { buildDigest } = await import('@/lib/digest/digest-builder')
    vi.mocked(buildDigest).mockReturnValue({ stats: {}, sections: [] } as unknown as ReturnType<typeof buildDigest>)

    const { GET } = await import('./route')
    await GET(new NextRequest('http://localhost/api/digest/activity?period=weekly'))

    expect(vi.mocked(buildDigest)).toHaveBeenCalledWith('weekly')
  })

  it('returns 500 when buildDigest throws', async () => {
    const { buildDigest } = await import('@/lib/digest/digest-builder')
    vi.mocked(buildDigest).mockImplementation(() => { throw new Error('Build failed') })

    const { GET } = await import('./route')
    const res = await GET(new NextRequest('http://localhost/api/digest/activity'))
    expect(res.status).toBe(500)
  })
})
