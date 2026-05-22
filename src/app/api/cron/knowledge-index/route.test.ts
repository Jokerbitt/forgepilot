import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/knowledge/nas-indexer', () => ({
  indexNasFiles: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

import { GET, POST } from './route'
import { indexNasFiles } from '@/lib/knowledge/nas-indexer'

const mockIndexNasFiles = vi.mocked(indexNasFiles)

function makeRequest(method = 'GET', authHeader?: string): NextRequest {
  return new NextRequest('http://localhost/api/cron/knowledge-index', {
    method,
    headers: authHeader ? { authorization: authHeader } : {},
  })
}

describe('GET /api/cron/knowledge-index', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
  })

  it('runs indexNasFiles and returns result', async () => {
    mockIndexNasFiles.mockResolvedValue({
      sourcesIndexed: 12,
      itemsIndexed: 48,
      cardsCreated: 24,
      skipped: 3,
      sensitiveSkipped: 1,
      errors: [],
    })

    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json() as Record<string, unknown>
    expect(body.ok).toBe(true)
    expect(body.sourcesIndexed).toBe(12)
    expect(body.cardsCreated).toBe(24)
    expect(typeof body.durationMs).toBe('number')
  })

  it('returns 500 when indexNasFiles throws', async () => {
    mockIndexNasFiles.mockRejectedValue(new Error('NAS not mounted'))

    const res = await GET(makeRequest())
    expect(res.status).toBe(500)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('NAS not mounted')
  })

  it('requires Bearer CRON_SECRET in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('CRON_SECRET', 'my-secret-token')

    const res = await GET(makeRequest('GET'))
    expect(res.status).toBe(401)
    expect(mockIndexNasFiles).not.toHaveBeenCalled()
  })

  it('accepts valid Bearer token in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('CRON_SECRET', 'valid-token')

    mockIndexNasFiles.mockResolvedValue({
      sourcesIndexed: 1, itemsIndexed: 2, cardsCreated: 1,
      skipped: 0, sensitiveSkipped: 0, errors: [],
    })

    const res = await GET(makeRequest('GET', 'Bearer valid-token'))
    expect(res.status).toBe(200)
    expect(mockIndexNasFiles).toHaveBeenCalledOnce()
  })

  it('skips auth when CRON_SECRET is not set in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('CRON_SECRET', '')

    mockIndexNasFiles.mockResolvedValue({
      sourcesIndexed: 0, itemsIndexed: 0, cardsCreated: 0,
      skipped: 0, sensitiveSkipped: 0, errors: [],
    })

    const res = await GET(makeRequest('GET'))
    expect(res.status).toBe(200)
  })
})

describe('POST /api/cron/knowledge-index', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
  })

  it('POST runs the same index logic as GET', async () => {
    mockIndexNasFiles.mockResolvedValue({
      sourcesIndexed: 5, itemsIndexed: 20, cardsCreated: 10,
      skipped: 1, sensitiveSkipped: 0, errors: [],
    })

    const res = await POST(makeRequest('POST'))
    expect(res.status).toBe(200)
    const body = await res.json() as { ok: boolean; sourcesIndexed: number }
    expect(body.ok).toBe(true)
    expect(body.sourcesIndexed).toBe(5)
  })
})
