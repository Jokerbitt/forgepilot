import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/attention/store', () => ({
  upsertAttentionItem: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

const VALID_BODY = {
  verdict: 'approved' as const,
  score: 8,
  risks: ['Auth bypass possible without rate limiting'],
  recommendation: 'Add rate limiting to the login endpoint.',
  linearComment: 'Score: 8/10. Good implementation overall.',
}

describe('POST /api/reports/daily/gbot4-feedback', () => {
  it('returns 201 and attentionItemId for valid approved payload', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/reports/daily/gbot4-feedback', {
      method: 'POST',
      body: JSON.stringify(VALID_BODY),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    const body = await res.json() as { saved: boolean; attentionItemId: string }

    expect(res.status).toBe(201)
    expect(body.saved).toBe(true)
    expect(typeof body.attentionItemId).toBe('string')
  })

  it('creates attention item with critical severity for critical verdict', async () => {
    const { POST } = await import('./route')
    const { upsertAttentionItem } = await import('@/lib/attention/store')

    const req = new NextRequest('http://localhost/api/reports/daily/gbot4-feedback', {
      method: 'POST',
      body: JSON.stringify({ ...VALID_BODY, verdict: 'critical', score: 2 }),
      headers: { 'Content-Type': 'application/json' },
    })
    await POST(req)

    const call = vi.mocked(upsertAttentionItem).mock.calls[0]?.[0]
    expect(call?.severity).toBe('critical')
    expect(call?.title).toContain('CRITICAL')
  })

  it('creates attention item with warning severity for needs_attention verdict', async () => {
    const { POST } = await import('./route')
    const { upsertAttentionItem } = await import('@/lib/attention/store')

    const req = new NextRequest('http://localhost/api/reports/daily/gbot4-feedback', {
      method: 'POST',
      body: JSON.stringify({ ...VALID_BODY, verdict: 'needs_attention', score: 5 }),
      headers: { 'Content-Type': 'application/json' },
    })
    await POST(req)

    const call = vi.mocked(upsertAttentionItem).mock.calls[0]?.[0]
    expect(call?.severity).toBe('warning')
  })

  it('includes sourceIssueId in title when provided', async () => {
    const { POST } = await import('./route')
    const { upsertAttentionItem } = await import('@/lib/attention/store')

    const req = new NextRequest('http://localhost/api/reports/daily/gbot4-feedback', {
      method: 'POST',
      body: JSON.stringify({ ...VALID_BODY, sourceIssueId: 'JOK-172' }),
      headers: { 'Content-Type': 'application/json' },
    })
    await POST(req)

    const call = vi.mocked(upsertAttentionItem).mock.calls[0]?.[0]
    expect(call?.title).toContain('JOK-172')
  })

  it('returns 422 when verdict is invalid', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/reports/daily/gbot4-feedback', {
      method: 'POST',
      body: JSON.stringify({ ...VALID_BODY, verdict: 'unknown' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(422)
  })

  it('returns 422 when score is out of range', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/reports/daily/gbot4-feedback', {
      method: 'POST',
      body: JSON.stringify({ ...VALID_BODY, score: 11 }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(422)
  })

  it('returns 422 when risks is not an array', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/reports/daily/gbot4-feedback', {
      method: 'POST',
      body: JSON.stringify({ ...VALID_BODY, risks: 'some risk' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(422)
  })

  it('returns 400 for malformed JSON', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/reports/daily/gbot4-feedback', {
      method: 'POST',
      body: 'not-json',
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
