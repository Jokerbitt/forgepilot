import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/pilot/orchestrator', () => ({
  runPilot: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/pilot', () => {
  it('runs pilot and returns 200 on success', async () => {
    const { runPilot } = await import('@/lib/pilot/orchestrator')
    vi.mocked(runPilot).mockResolvedValue({
      status: 'completed',
      briefId: 'brief-1',
      runId: 'run-1',
      delegationId: 'del-1',
      autoExecuted: false,
    } as unknown as Awaited<ReturnType<typeof runPilot>>)

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      body: JSON.stringify({
        workItemId: 'FP-101',
        title: 'User auth system',
        goal: 'Build a user auth system for the app',
        privacyMode: 'hybrid',
      }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    const body = await res.json() as { status: string; briefId: string }

    expect(res.status).toBe(200)
    expect(body.status).toBe('completed')
    expect(body.briefId).toBe('brief-1')
  })

  it('returns 422 when pilot fails', async () => {
    const { runPilot } = await import('@/lib/pilot/orchestrator')
    vi.mocked(runPilot).mockResolvedValue({
      status: 'failed',
      error: 'AI provider not configured',
    } as unknown as Awaited<ReturnType<typeof runPilot>>)

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      body: JSON.stringify({
        workItemId: 'FP-102',
        title: 'User auth system',
        goal: 'Build a user auth system for the app',
        privacyMode: 'hybrid',
      }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)

    expect(res.status).toBe(422)
  })

  it('returns 400 when required fields missing', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)

    expect(res.status).toBe(400)
  })
})
