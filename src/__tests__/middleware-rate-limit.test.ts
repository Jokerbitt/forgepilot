/**
 * M189 — Middleware rate limiting tests
 *
 * Tests that the middleware correctly applies rate limiting to mutating
 * requests and passes GET/HEAD requests through without rate-limit checks.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

// Mock next-auth/jwt so the middleware auth-check is bypassed
vi.mock('next-auth/jwt', () => ({
  getToken: vi.fn().mockResolvedValue({ sub: 'user-1' }),
}))

// Mock auth config helpers to skip the auth layer entirely
vi.mock('@/lib/auth/config', () => ({
  isForgePilotAuthEnabled: vi.fn().mockReturnValue(false),
  isAuthConfigured: vi.fn().mockReturnValue(true),
  shouldProtectPath: vi.fn().mockReturnValue(false),
  isPublicOperationalPath: vi.fn().mockReturnValue(false),
}))

describe('middleware — rate limiting (M189)', () => {
  beforeEach(async () => {
    // Reset the store before each test to avoid cross-test pollution
    const { rateLimiterStore } = await import('@/lib/rate-limit')
    rateLimiterStore.reset()
    vi.resetModules()
  })

  it('passes GET requests through without rate-limit check', async () => {
    const { middleware } = await import('@/middleware')
    const req = new NextRequest('http://localhost/api/delegations', {
      method: 'GET',
      headers: { 'x-forwarded-for': '1.2.3.4' },
    })
    const response = await middleware(req)
    expect(response.status).not.toBe(429)
  })

  it('passes HEAD requests through without rate-limit check', async () => {
    const { middleware } = await import('@/middleware')
    const req = new NextRequest('http://localhost/api/delegations', {
      method: 'HEAD',
      headers: { 'x-forwarded-for': '1.2.3.4' },
    })
    const response = await middleware(req)
    expect(response.status).not.toBe(429)
  })

  it('allows POST requests within the rate limit', async () => {
    const { middleware } = await import('@/middleware')
    const req = new NextRequest('http://localhost/api/delegations', {
      method: 'POST',
      headers: { 'x-forwarded-for': '2.2.2.2' },
    })
    const response = await middleware(req)
    expect(response.status).not.toBe(429)
  })

  it('returns 429 when POST rate limit is exceeded for expensive route', async () => {
    const { middleware } = await import('@/middleware')
    const { rateLimiterStore } = await import('@/lib/rate-limit')

    // Exhaust the expensive tier limit (10/min) for this IP + path
    const ip = '3.3.3.3'
    const path = '/api/delegations/abc/execute'
    const key = `rl:${ip}:${path}`
    for (let i = 0; i < 10; i++) {
      rateLimiterStore.check(key, 10, 60_000)
    }

    const req = new NextRequest(`http://localhost${path}`, {
      method: 'POST',
      headers: { 'x-forwarded-for': ip },
    })
    const response = await middleware(req)
    expect(response.status).toBe(429)

    const body = await response.json() as { error: string; retryAfter: number }
    expect(body.error).toBe('Too Many Requests')
    expect(body.retryAfter).toBeGreaterThan(0)
  })

  it('returns rate limit headers on 429 response', async () => {
    const { middleware } = await import('@/middleware')
    const { rateLimiterStore } = await import('@/lib/rate-limit')

    const ip = '4.4.4.4'
    const path = '/api/ai/generate'
    const key = `rl:${ip}:${path}`
    for (let i = 0; i < 10; i++) {
      rateLimiterStore.check(key, 10, 60_000)
    }

    const req = new NextRequest(`http://localhost${path}`, {
      method: 'POST',
      headers: { 'x-forwarded-for': ip },
    })
    const response = await middleware(req)
    expect(response.status).toBe(429)
    expect(response.headers.get('X-RateLimit-Limit')).toBe('10')
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('0')
    expect(response.headers.get('Retry-After')).toBeDefined()
  })

  it('uses standard tier (60/min) for non-expensive routes', async () => {
    const { middleware } = await import('@/middleware')
    const { rateLimiterStore } = await import('@/lib/rate-limit')

    // After 60 standard requests are exhausted, the 61st should be blocked
    const ip = '5.5.5.5'
    const path = '/api/settings'
    const key = `rl:${ip}:${path}`
    for (let i = 0; i < 60; i++) {
      rateLimiterStore.check(key, 60, 60_000)
    }

    const req = new NextRequest(`http://localhost${path}`, {
      method: 'POST',
      headers: { 'x-forwarded-for': ip },
    })
    const response = await middleware(req)
    expect(response.status).toBe(429)
  })

  it('does not apply rate limiting to non-API paths', async () => {
    const { middleware } = await import('@/middleware')
    const req = new NextRequest('http://localhost/settings', {
      method: 'POST',
      headers: { 'x-forwarded-for': '6.6.6.6' },
    })
    const response = await middleware(req)
    expect(response.status).not.toBe(429)
  })
})
