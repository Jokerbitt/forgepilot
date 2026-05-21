/**
 * M201 — Middleware API key authentication tests
 *
 * Tests that the optional FORGEPILOT_API_KEY mechanism:
 * 1. Without FORGEPILOT_API_KEY — all requests pass through unchanged
 * 2. With FORGEPILOT_API_KEY set — requests without auth header get 401
 * 3. With FORGEPILOT_API_KEY set and correct Bearer token — requests pass
 * 4. /api/intake and /api/cron/* are excluded from the auth check
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

// Mock next-auth/jwt so the session-auth layer is bypassed
vi.mock('next-auth/jwt', () => ({
  getToken: vi.fn().mockResolvedValue({ sub: 'user-1' }),
}))

// Mock auth config helpers to skip the NextAuth-based auth layer entirely
vi.mock('@/lib/auth/config', () => ({
  isForgePilotAuthEnabled: vi.fn().mockReturnValue(false),
  isAuthConfigured: vi.fn().mockReturnValue(true),
  shouldProtectPath: vi.fn().mockReturnValue(false),
  isPublicOperationalPath: vi.fn().mockReturnValue(false),
}))

const TEST_KEY = 'test-api-key-abc123'

describe('middleware — API key authentication (M201)', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    delete process.env.FORGEPILOT_API_KEY
  })

  describe('without FORGEPILOT_API_KEY set', () => {
    it('passes any /api/ request through without requiring an auth header', async () => {
      delete process.env.FORGEPILOT_API_KEY
      const { middleware } = await import('@/middleware')

      const req = new NextRequest('http://localhost/api/delegations', {
        method: 'GET',
      })
      const response = await middleware(req)
      expect(response.status).not.toBe(401)
    })

    it('passes a request with no headers at all', async () => {
      delete process.env.FORGEPILOT_API_KEY
      const { middleware } = await import('@/middleware')

      const req = new NextRequest('http://localhost/api/settings', {
        method: 'POST',
      })
      const response = await middleware(req)
      expect(response.status).not.toBe(401)
    })
  })

  describe('with FORGEPILOT_API_KEY set', () => {
    it('returns 401 when Authorization header is missing', async () => {
      process.env.FORGEPILOT_API_KEY = TEST_KEY
      const { middleware } = await import('@/middleware')

      const req = new NextRequest('http://localhost/api/delegations', {
        method: 'GET',
      })
      const response = await middleware(req)
      expect(response.status).toBe(401)

      const body = await response.json() as { error: string }
      expect(body.error).toBe('Unauthorized')
    })

    it('returns 401 when Authorization header has wrong token', async () => {
      process.env.FORGEPILOT_API_KEY = TEST_KEY
      const { middleware } = await import('@/middleware')

      const req = new NextRequest('http://localhost/api/delegations', {
        method: 'GET',
        headers: { authorization: 'Bearer wrong-key' },
      })
      const response = await middleware(req)
      expect(response.status).toBe(401)
    })

    it('returns 401 when Authorization uses non-Bearer scheme', async () => {
      process.env.FORGEPILOT_API_KEY = TEST_KEY
      const { middleware } = await import('@/middleware')

      const req = new NextRequest('http://localhost/api/settings', {
        method: 'GET',
        headers: { authorization: `Basic ${TEST_KEY}` },
      })
      const response = await middleware(req)
      expect(response.status).toBe(401)
    })

    it('passes through when correct Bearer token is provided', async () => {
      process.env.FORGEPILOT_API_KEY = TEST_KEY
      const { middleware } = await import('@/middleware')

      const req = new NextRequest('http://localhost/api/delegations', {
        method: 'GET',
        headers: { authorization: `Bearer ${TEST_KEY}` },
      })
      const response = await middleware(req)
      expect(response.status).not.toBe(401)
    })

    it('returns 401 response with application/json content-type', async () => {
      process.env.FORGEPILOT_API_KEY = TEST_KEY
      const { middleware } = await import('@/middleware')

      const req = new NextRequest('http://localhost/api/delegations', {
        method: 'POST',
      })
      const response = await middleware(req)
      expect(response.status).toBe(401)
      expect(response.headers.get('content-type')).toContain('application/json')
    })
  })

  describe('excluded paths', () => {
    beforeEach(() => {
      process.env.FORGEPILOT_API_KEY = TEST_KEY
    })

    it('does not require auth on /api/intake', async () => {
      const { middleware } = await import('@/middleware')

      const req = new NextRequest('http://localhost/api/intake', {
        method: 'POST',
      })
      const response = await middleware(req)
      expect(response.status).not.toBe(401)
    })

    it('does not require auth on /api/intake/* subpaths', async () => {
      const { middleware } = await import('@/middleware')

      const req = new NextRequest('http://localhost/api/intake/linear', {
        method: 'POST',
      })
      const response = await middleware(req)
      expect(response.status).not.toBe(401)
    })

    it('does not require auth on /api/cron/* paths', async () => {
      const { middleware } = await import('@/middleware')

      const req = new NextRequest('http://localhost/api/cron/telegram-digest', {
        method: 'GET',
      })
      const response = await middleware(req)
      expect(response.status).not.toBe(401)
    })

    it('does not require auth on /api/health', async () => {
      const { middleware } = await import('@/middleware')

      const req = new NextRequest('http://localhost/api/health', {
        method: 'GET',
      })
      const response = await middleware(req)
      expect(response.status).not.toBe(401)
    })

    it('does not require auth on /api/ready', async () => {
      const { middleware } = await import('@/middleware')

      const req = new NextRequest('http://localhost/api/ready', {
        method: 'GET',
      })
      const response = await middleware(req)
      expect(response.status).not.toBe(401)
    })

    it('does not require auth on /api/webhooks/* paths', async () => {
      const { middleware } = await import('@/middleware')

      const req = new NextRequest('http://localhost/api/webhooks/linear', {
        method: 'POST',
      })
      const response = await middleware(req)
      expect(response.status).not.toBe(401)
    })

    it('DOES require auth on non-excluded /api/ routes', async () => {
      const { middleware } = await import('@/middleware')

      const req = new NextRequest('http://localhost/api/project-briefs', {
        method: 'GET',
      })
      const response = await middleware(req)
      expect(response.status).toBe(401)
    })
  })
})
