import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn().mockResolvedValue(null),
}))
vi.mock('@/lib/config/autonomous-config', () => ({
  getAutonomousConfig: vi.fn(),
  saveAutonomousConfig: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/settings/autonomous', () => {
  it('returns current autonomous config', async () => {
    const { getAutonomousConfig } = await import('@/lib/config/autonomous-config')
    vi.mocked(getAutonomousConfig).mockReturnValue({ enabled: true, autoApproveDelegations: false } as ReturnType<typeof getAutonomousConfig>)

    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json() as { enabled: boolean }

    expect(res.status).toBe(200)
    expect(body.enabled).toBe(true)
  })
})

describe('POST /api/settings/autonomous', () => {
  it('saves autonomous config and returns saved value', async () => {
    const { saveAutonomousConfig } = await import('@/lib/config/autonomous-config')
    vi.mocked(saveAutonomousConfig).mockReturnValue({ enabled: true, autoApproveDelegations: true } as ReturnType<typeof saveAutonomousConfig>)

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/settings/autonomous', {
      method: 'POST',
      body: JSON.stringify({ enabled: true, autoApproveDelegations: true }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    const body = await res.json() as { enabled: boolean; autoApproveDelegations: boolean }

    expect(res.status).toBe(200)
    expect(body.enabled).toBe(true)
    expect(body.autoApproveDelegations).toBe(true)
  })

  it('returns 400 when body is malformed JSON', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/settings/autonomous', {
      method: 'POST',
      body: 'not-json',
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
