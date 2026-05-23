import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/dsgvo/processing-ledger', () => ({
  runRetentionCleanup: vi.fn(),
}))
vi.mock('@/lib/cron/auth', () => ({
  isCronAuthorized: vi.fn(),
}))
vi.mock('@/lib/logger', () => ({
  dsgvoLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/cron/retention', () => {
  it('returns 401 when unauthorized', async () => {
    const { isCronAuthorized } = await import('@/lib/cron/auth')
    vi.mocked(isCronAuthorized).mockReturnValue(false)

    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost/api/cron/retention')
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('runs cleanup and returns deletedCount when authorized', async () => {
    const { isCronAuthorized } = await import('@/lib/cron/auth')
    const { runRetentionCleanup } = await import('@/lib/dsgvo/processing-ledger')
    vi.mocked(isCronAuthorized).mockReturnValue(true)
    vi.mocked(runRetentionCleanup).mockResolvedValue({ deleted: 12 })

    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost/api/cron/retention', {
      headers: { Authorization: 'Bearer test-secret' },
    })
    const res = await GET(req)
    const body = await res.json() as { ok: boolean; deletedCount: number }

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.deletedCount).toBe(12)
  })

  it('returns 500 when cleanup throws', async () => {
    const { isCronAuthorized } = await import('@/lib/cron/auth')
    const { runRetentionCleanup } = await import('@/lib/dsgvo/processing-ledger')
    vi.mocked(isCronAuthorized).mockReturnValue(true)
    vi.mocked(runRetentionCleanup).mockRejectedValue(new Error('disk full'))

    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost/api/cron/retention')
    const res = await GET(req)
    expect(res.status).toBe(500)
  })
})
