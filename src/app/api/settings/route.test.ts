import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn().mockResolvedValue(null),
}))
vi.mock('@/lib/nba-engine/nba-config', () => ({
  getNBAConfig: vi.fn(),
  saveNBAConfig: vi.fn(),
}))
vi.mock('@/lib/logger', () => ({
  apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/settings', () => {
  it('returns NBA config', async () => {
    const { requireAuth } = await import('@/lib/auth/require-auth')
    const { getNBAConfig } = await import('@/lib/nba-engine/nba-config')
    vi.mocked(requireAuth).mockResolvedValue(null)
    vi.mocked(getNBAConfig).mockReturnValue({ approvalMode: 'manual', maxConcurrentAgents: 2 } as ReturnType<typeof getNBAConfig>)

    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json() as { approvalMode: string }

    expect(res.status).toBe(200)
    expect(body.approvalMode).toBe('manual')
  })

  it('returns 401 when not authenticated', async () => {
    const { requireAuth } = await import('@/lib/auth/require-auth')
    const { NextResponse } = await import('next/server')
    vi.mocked(requireAuth).mockResolvedValue(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))

    const { GET } = await import('./route')
    const res = await GET()
    expect(res.status).toBe(401)
  })
})

describe('POST /api/settings', () => {
  it('saves updated settings and returns merged config', async () => {
    const { requireAuth } = await import('@/lib/auth/require-auth')
    const { getNBAConfig, saveNBAConfig } = await import('@/lib/nba-engine/nba-config')

    vi.mocked(requireAuth).mockResolvedValue(null)
    vi.mocked(getNBAConfig).mockReturnValue({ approvalMode: 'manual', maxConcurrentAgents: 1 } as ReturnType<typeof getNBAConfig>)
    vi.mocked(saveNBAConfig).mockReturnValue(undefined)

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/settings', {
      method: 'POST',
      body: JSON.stringify({ approvalMode: 'autopilot' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    const body = await res.json() as { approvalMode: string }

    expect(res.status).toBe(200)
    expect(body.approvalMode).toBe('autopilot')
    expect(vi.mocked(saveNBAConfig)).toHaveBeenCalled()
  })
})
