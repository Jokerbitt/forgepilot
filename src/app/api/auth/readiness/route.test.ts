import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/auth/readiness', () => ({
  getAuthReadiness: vi.fn(() => ({
    enabled: true,
    configured: true,
    bypassRequested: false,
    bypassAllowed: false,
    productionRuntime: false,
    readyForProduction: true,
    status: 'ready',
    missingEnv: [],
    checks: [],
    nextAction: 'Auth is ready for V1 single-user production use.',
  })),
}))

describe('GET /api/auth/readiness', () => {
  it('returns sanitized auth readiness with no-store cache headers', async () => {
    const { GET } = await import('./route')
    const res = await GET()
    const data = await res.json()

    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(data).toMatchObject({
      enabled: true,
      readyForProduction: true,
      status: 'ready',
    })
    expect(JSON.stringify(data)).not.toContain('FORGEPILOT_ADMIN_PASSWORD=')
    expect(JSON.stringify(data)).not.toContain('NEXTAUTH_SECRET=')
  })
})
