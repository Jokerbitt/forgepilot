import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('@/lib/dsgvo/erasure', () => ({
  requestErasure: vi.fn((id: string) => Promise.resolve({ externalId: id, requestedAt: new Date().toISOString() })),
  executeErasure: vi.fn((id: string) => Promise.resolve({ externalId: id, erasedAt: new Date().toISOString(), deletedRecords: 3 })),
  getErasureStatus: vi.fn((id: string) => Promise.resolve({ externalId: id, status: 'pending' })),
}))

vi.mock('@/lib/logger', () => ({
  dsgvoLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function callPost(body: unknown) {
  const { POST } = await import('./route')
  const req = new Request('http://localhost/api/dsgvo/erasure', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return POST(req as import('next/server').NextRequest)
}

async function callGet(params: Record<string, string>) {
  const { GET } = await import('./route')
  const url = new URL('http://localhost/api/dsgvo/erasure')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const req = new Request(url.toString())
  return GET(req as import('next/server').NextRequest)
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('DSGVO Erasure Route', () => {
  beforeEach(() => { vi.clearAllMocks() })

  describe('GET /api/dsgvo/erasure', () => {
    it('returns 400 when externalId is missing', async () => {
      const res = await callGet({})
      expect(res.status).toBe(400)
    })

    it('returns erasure status for a valid externalId', async () => {
      const res = await callGet({ externalId: 'user-123' })
      expect(res.status).toBe(200)
      const data = await res.json() as { externalId: string; status: string }
      expect(data.externalId).toBe('user-123')
      expect(data.status).toBe('pending')
    })
  })

  describe('POST /api/dsgvo/erasure', () => {
    it('returns 400 for missing externalId', async () => {
      const res = await callPost({ execute: false })
      expect(res.status).toBe(400)
      const data = await res.json() as { error: string }
      expect(data.error).toBe('Validation failed')
    })

    it('returns 400 for invalid JSON', async () => {
      const { POST } = await import('./route')
      const req = new Request('http://localhost/api/dsgvo/erasure', {
        method: 'POST',
        body: 'not-json',
      })
      const res = await POST(req as import('next/server').NextRequest)
      expect(res.status).toBe(400)
    })

    it('requests erasure (no execute flag) and returns subject', async () => {
      const res = await callPost({ externalId: 'user-456' })
      expect(res.status).toBe(200)
      const data = await res.json() as { externalId: string }
      expect(data.externalId).toBe('user-456')

      const { requestErasure } = await import('@/lib/dsgvo/erasure')
      expect(vi.mocked(requestErasure)).toHaveBeenCalledWith('user-456')
    })

    it('executes erasure when execute:true and returns deleted count', async () => {
      const res = await callPost({ externalId: 'user-789', execute: true })
      expect(res.status).toBe(200)
      const data = await res.json() as { externalId: string; deletedRecords: number }
      expect(data.externalId).toBe('user-789')
      expect(data.deletedRecords).toBe(3)

      const { executeErasure } = await import('@/lib/dsgvo/erasure')
      expect(vi.mocked(executeErasure)).toHaveBeenCalledWith('user-789')
    })

    it('logs erasure events via dsgvoLogger', async () => {
      await callPost({ externalId: 'user-log-test', execute: true })
      const { dsgvoLogger } = await import('@/lib/logger')
      expect(vi.mocked(dsgvoLogger.info)).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'dsgvo.erasure.execute', externalId: 'user-log-test' }),
      )
    })
  })
})
