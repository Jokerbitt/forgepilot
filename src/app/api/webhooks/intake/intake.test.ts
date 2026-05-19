import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

const mockBrief = {
  id: 'webhook-brief-id', title: 'Webhook-Idee', status: 'in_review' as const,
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  rawIdea: 'idea', problemStatement: 'problem', targetAudience: 'Unbekannt', desiredOutcome: 'TBD',
  constraints: [], scope: 'minimal' as const, researchMode: 'quick' as const, privacyMode: 'local' as const,
  requirements: [], useCases: [], nonGoals: [], risks: [], researchRunIds: [],
  researchBriefDraft: { title: '', mode: 'quick' as const, privacyMode: 'local' as const, preferredExecutor: 'agent' as const, researchQuestions: [], searchTerms: [], preferredSourceTypes: [], excludeCriteria: [] },
}

vi.mock('@/lib/project-briefs', () => ({
  buildProjectBrief: vi.fn(() => mockBrief),
  saveProjectBrief: vi.fn((brief) => brief),
}))

vi.mock('fs', () => ({
  default: { existsSync: vi.fn(() => false), readFileSync: vi.fn(() => '[]'), writeFileSync: vi.fn(), mkdirSync: vi.fn() },
}))

function makeRequest(body: unknown, options?: { bearerToken?: string }): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (options?.bearerToken) headers['Authorization'] = `Bearer ${options.bearerToken}`
  return new Request('http://localhost/api/webhooks/intake', { method: 'POST', headers, body: JSON.stringify(body) }) as unknown as NextRequest
}

describe('POST /api/webhooks/intake', () => {
  beforeEach(() => { vi.clearAllMocks(); delete process.env.WEBHOOK_SECRET })

  it('returns 200 with processed array for event: new-idea', async () => {
    const { POST } = await import('./route')
    const res = await POST(makeRequest({ event: 'new-idea', payload: { title: 'Test' }, source: 'zapier' }))
    expect(res.status).toBe(200)
    const data = await res.json() as { received: boolean; processed: string[] }
    expect(data.received).toBe(true)
    expect(data.processed[0]).toMatch(/^brief:/)
  })

  it('returns 400 when body is invalid JSON', async () => {
    const { POST } = await import('./route')
    const req = new Request('http://localhost/api/webhooks/intake', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'not-json' }) as unknown as NextRequest
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 422 for unsupported event type', async () => {
    const { POST } = await import('./route')
    const res = await POST(makeRequest({ event: 'unknown-event', payload: {} }))
    expect(res.status).toBe(422)
    const data = await res.json() as { error: string }
    expect(data.error).toMatch(/unsupported event/i)
  })

  it('returns 200 for event: new-task', async () => {
    const { POST } = await import('./route')
    const res = await POST(makeRequest({ event: 'new-task', payload: { title: 'Task' }, source: 'n8n' }))
    expect(res.status).toBe(200)
    const data = await res.json() as { received: boolean; processed: string[] }
    expect(data.processed[0]).toMatch(/^task:/)
  })

  it('returns 200 for event: delegation-trigger', async () => {
    const { POST } = await import('./route')
    const res = await POST(makeRequest({ event: 'delegation-trigger', payload: { delegationId: 'deleg-abc-123' } }))
    expect(res.status).toBe(200)
    const data = await res.json() as { received: boolean; processed: string[] }
    expect(data.processed[0]).toBe('delegation-trigger:deleg-abc-123')
  })

  it('returns 400 when event field is missing', async () => {
    const { POST } = await import('./route')
    const res = await POST(makeRequest({ payload: {} }))
    expect(res.status).toBe(400)
    const data = await res.json() as { error: string }
    expect(data.error).toMatch(/event/i)
  })

  it('returns 401 when WEBHOOK_SECRET set but token missing', async () => {
    process.env.WEBHOOK_SECRET = 'my-secret'
    const { POST } = await import('./route')
    const res = await POST(makeRequest({ event: 'new-idea', payload: {} }))
    expect(res.status).toBe(401)
  })

  it('returns 200 with correct bearer token', async () => {
    process.env.WEBHOOK_SECRET = 'my-secret'
    const { POST } = await import('./route')
    const res = await POST(makeRequest({ event: 'delegation-trigger', payload: {} }, { bearerToken: 'my-secret' }))
    expect(res.status).toBe(200)
  })
})
