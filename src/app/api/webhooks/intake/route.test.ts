import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/project-briefs', () => ({
  buildProjectBrief: vi.fn().mockReturnValue({ id: 'brief-1' }),
  saveProjectBrief: vi.fn(),
}))
vi.mock('@/lib/logger', () => ({
  apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockReturnValue({ allowed: true, remaining: 99 }),
  buildRateLimitHeaders: vi.fn().mockReturnValue({}),
}))
vi.mock('fs', () => ({
  default: { existsSync: vi.fn().mockReturnValue(false), readFileSync: vi.fn(), writeFileSync: vi.fn() },
}))

beforeEach(() => {
  vi.clearAllMocks()
  delete process.env.WEBHOOK_SECRET
})

describe('POST /api/webhooks/intake', () => {
  it('returns 401 when secret is set and request is unauthorized', async () => {
    process.env.WEBHOOK_SECRET = 'super-secret'

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/webhooks/intake', {
      method: 'POST',
      body: JSON.stringify({ event: 'new-idea', payload: {} }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('processes new-idea event and returns received: true', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/webhooks/intake', {
      method: 'POST',
      body: JSON.stringify({
        event: 'new-idea',
        payload: { title: 'Test', rawIdea: 'An idea', problemStatement: 'A problem', targetAudience: 'Devs', desiredOutcome: 'Ship it' },
      }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    const body = await res.json() as { received: boolean; processed: string[] }

    expect(res.status).toBe(200)
    expect(body.received).toBe(true)
    expect(body.processed[0]).toMatch(/^brief:/)
  })

  it('returns 422 for unsupported event type', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/webhooks/intake', {
      method: 'POST',
      body: JSON.stringify({ event: 'unknown-event', payload: {} }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(422)
  })

  it('returns 400 for missing event field', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/webhooks/intake', {
      method: 'POST',
      body: JSON.stringify({ payload: {} }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 for malformed JSON', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/webhooks/intake', {
      method: 'POST',
      body: 'not-json',
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
