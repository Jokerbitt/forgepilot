import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { RoutingDecision } from '@/lib/models/model-router'

vi.mock('@/lib/model-router/store', () => ({
  getDecisions: vi.fn(),
  saveDecision: vi.fn((d: RoutingDecision) => d),
}))

vi.mock('@/lib/model-router/router', () => ({
  routeTask: vi.fn(),
}))

beforeEach(() => {
  vi.resetModules()
})

const mockDecision: RoutingDecision = {
  id: 'dec-1',
  taskId: 'task-abc',
  selectedModelProfileId: 'ollama-llama3',
  selectedProvider: 'ollama',
  selectedModel: 'llama3',
  workload: 'coding',
  reason: 'local preferred',
  privacyMode: 'local-only',
  requiresApproval: false,
  createdAt: new Date().toISOString(),
}

describe('GET /api/model-router', () => {
  it('returns array of decisions', async () => {
    const store = await import('@/lib/model-router/store')
    vi.mocked(store.getDecisions).mockReturnValue([mockDecision])

    const { GET } = await import('./route')
    const res = await GET(new Request('http://localhost/api/model-router'))
    const body = await res.json()

    expect(Array.isArray(body)).toBe(true)
    expect(body[0].taskId).toBe('task-abc')
  })
})

describe('POST /api/model-router', () => {
  it('returns 201 with decision for valid body', async () => {
    const store = await import('@/lib/model-router/store')
    const router = await import('@/lib/model-router/router')
    vi.mocked(router.routeTask).mockReturnValue(mockDecision)
    vi.mocked(store.saveDecision).mockReturnValue(mockDecision)

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/model-router', {
      method: 'POST',
      body: JSON.stringify({ taskId: 'task-abc', workload: 'coding', privacyMode: 'local-only' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.taskId).toBe('task-abc')
  })

  it('returns 400 for invalid body (missing required fields)', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/model-router', {
      method: 'POST',
      body: JSON.stringify({ workload: 'coding' }), // missing taskId and privacyMode
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)

    expect(res.status).toBe(400)
  })
})
