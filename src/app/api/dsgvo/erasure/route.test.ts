import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mock erasure lib ─────────────────────────────────────────────────────────

vi.mock('@/lib/dsgvo/erasure', () => ({
  requestErasure: vi.fn(),
  executeErasure: vi.fn(),
  getErasureStatus: vi.fn(),
}))

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(url: string, body?: unknown): Request {
  if (body !== undefined) {
    return new Request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }
  return new Request(url)
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/dsgvo/erasure', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('returns 400 when externalId is missing', async () => {
    const { GET } = await import('./route')
    const req = new Request('http://localhost/api/dsgvo/erasure')
    const res = await GET(req as Parameters<typeof GET>[0])
    expect(res.status).toBe(400)
    const data = await res.json() as { error: string }
    expect(data.error).toContain('externalId')
  })

  it('returns erasure status for a known subject', async () => {
    const { getErasureStatus } = await import('@/lib/dsgvo/erasure')
    vi.mocked(getErasureStatus).mockResolvedValueOnce({
      id: 'sub-123',
      externalId: 'user-123',
      createdAt: '2026-01-01T00:00:00Z',
      erasureRequestedAt: '2026-01-02T00:00:00Z',
    })

    vi.resetModules()
    const { GET } = await import('./route')
    const req = new Request('http://localhost/api/dsgvo/erasure?externalId=user-123')
    const res = await GET(req as Parameters<typeof GET>[0])
    expect(res.status).toBe(200)
    const data = await res.json() as { externalId: string }
    expect(data.externalId).toBe('user-123')
  })
})

describe('POST /api/dsgvo/erasure', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('returns 400 when externalId is missing', async () => {
    const { POST } = await import('./route')
    const req = makeRequest('http://localhost/api/dsgvo/erasure', {})
    const res = await POST(req as Parameters<typeof POST>[0])
    expect(res.status).toBe(400)
  })

  it('calls requestErasure when execute is falsy', async () => {
    const { requestErasure } = await import('@/lib/dsgvo/erasure')
    vi.mocked(requestErasure).mockResolvedValueOnce({
      id: 'sub-1',
      externalId: 'user-abc',
      createdAt: '2026-01-01T00:00:00Z',
      erasureRequestedAt: '2026-01-02T00:00:00Z',
    })

    vi.resetModules()
    const { POST } = await import('./route')
    const req = makeRequest('http://localhost/api/dsgvo/erasure', { externalId: 'user-abc' })
    const res = await POST(req as Parameters<typeof POST>[0])
    expect(res.status).toBe(200)
    const data = await res.json() as { externalId: string }
    expect(data.externalId).toBe('user-abc')
  })

  it('calls executeErasure when execute is true', async () => {
    const { executeErasure } = await import('@/lib/dsgvo/erasure')
    vi.mocked(executeErasure).mockResolvedValueOnce({
      externalId: 'user-abc',
      recordsDeleted: 5,
      erasedAt: '2026-01-03T00:00:00Z',
    })

    vi.resetModules()
    const { POST } = await import('./route')
    const req = makeRequest('http://localhost/api/dsgvo/erasure', { externalId: 'user-abc', execute: true })
    const res = await POST(req as Parameters<typeof POST>[0])
    expect(res.status).toBe(200)
    const data = await res.json() as { recordsDeleted: number }
    expect(data.recordsDeleted).toBe(5)
  })
})
