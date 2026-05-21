/**
 * M102 — Rate Limiter tests
 * Tests the in-memory sliding-window rate limiter.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

// ─── Core store tests ─────────────────────────────────────────────────────────

describe('RateLimiterStore', () => {
  beforeEach(async () => {
    const { rateLimiterStore } = await import('@/lib/rate-limit')
    rateLimiterStore.reset()
  })

  it('allows requests within limit', async () => {
    const { rateLimiterStore } = await import('@/lib/rate-limit')
    for (let i = 0; i < 5; i++) {
      const result = rateLimiterStore.check('test-key', 5, 60_000)
      expect(result.allowed).toBe(true)
    }
  })

  it('blocks when limit is exceeded', async () => {
    const { rateLimiterStore } = await import('@/lib/rate-limit')
    for (let i = 0; i < 5; i++) {
      rateLimiterStore.check('test-key', 5, 60_000)
    }
    const result = rateLimiterStore.check('test-key', 5, 60_000)
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it('returns retryAfter when blocked', async () => {
    const { rateLimiterStore } = await import('@/lib/rate-limit')
    for (let i = 0; i < 3; i++) {
      rateLimiterStore.check('key-x', 3, 60_000)
    }
    const result = rateLimiterStore.check('key-x', 3, 60_000)
    expect(result.allowed).toBe(false)
    expect(result.retryAfter).toBeGreaterThan(0)
    expect(result.retryAfter).toBeLessThanOrEqual(60)
  })

  it('decrements remaining count correctly', async () => {
    const { rateLimiterStore } = await import('@/lib/rate-limit')
    const first = rateLimiterStore.check('count-key', 10, 60_000)
    expect(first.remaining).toBe(9)
    const second = rateLimiterStore.check('count-key', 10, 60_000)
    expect(second.remaining).toBe(8)
  })

  it('uses separate counters per key', async () => {
    const { rateLimiterStore } = await import('@/lib/rate-limit')
    for (let i = 0; i < 5; i++) rateLimiterStore.check('key-a', 5, 60_000)
    // key-a is exhausted, key-b should still work
    const resultA = rateLimiterStore.check('key-a', 5, 60_000)
    const resultB = rateLimiterStore.check('key-b', 5, 60_000)
    expect(resultA.allowed).toBe(false)
    expect(resultB.allowed).toBe(true)
  })

  it('slides window — old requests expire', async () => {
    const { rateLimiterStore } = await import('@/lib/rate-limit')
    vi.useFakeTimers()
    const now = Date.now()
    vi.setSystemTime(now)

    // Fill the 1s window
    for (let i = 0; i < 3; i++) rateLimiterStore.check('slide-key', 3, 1_000)
    const blocked = rateLimiterStore.check('slide-key', 3, 1_000)
    expect(blocked.allowed).toBe(false)

    // Advance time past the window
    vi.setSystemTime(now + 1_100)
    const allowed = rateLimiterStore.check('slide-key', 3, 1_000)
    expect(allowed.allowed).toBe(true)

    vi.useRealTimers()
  })

  it('reports correct limit in result', async () => {
    const { rateLimiterStore } = await import('@/lib/rate-limit')
    const result = rateLimiterStore.check('limit-check', 42, 60_000)
    expect(result.limit).toBe(42)
  })
})

// ─── getClientKey ─────────────────────────────────────────────────────────────

describe('getClientKey', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('uses X-Forwarded-For when present', async () => {
    const { getClientKey } = await import('@/lib/rate-limit')
    const req = new NextRequest('http://localhost/api/test', {
      headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
    })
    const key = getClientKey(req)
    expect(key).toBe('ip:1.2.3.4')
  })

  it('uses unknown when no IP headers', async () => {
    const { getClientKey } = await import('@/lib/rate-limit')
    const req = new NextRequest('http://localhost/api/test')
    const key = getClientKey(req)
    expect(key).toMatch(/^ip:/)
  })

  it('applies custom key prefix', async () => {
    const { getClientKey } = await import('@/lib/rate-limit')
    const req = new NextRequest('http://localhost/api/test', {
      headers: { 'x-forwarded-for': '9.9.9.9' },
    })
    const key = getClientKey(req, 'webhook')
    expect(key).toBe('webhook:9.9.9.9')
  })
})

// ─── buildRateLimitHeaders ────────────────────────────────────────────────────

describe('buildRateLimitHeaders', () => {
  it('includes X-RateLimit-Limit and Remaining', async () => {
    const { buildRateLimitHeaders } = await import('@/lib/rate-limit')
    const headers = buildRateLimitHeaders({ allowed: true, remaining: 42, limit: 100 })
    expect(headers['X-RateLimit-Limit']).toBe('100')
    expect(headers['X-RateLimit-Remaining']).toBe('42')
  })

  it('includes Retry-After only when blocked', async () => {
    const { buildRateLimitHeaders } = await import('@/lib/rate-limit')
    const blocked = buildRateLimitHeaders({ allowed: false, remaining: 0, limit: 10, retryAfter: 30 })
    expect(blocked['Retry-After']).toBe('30')
    const allowed = buildRateLimitHeaders({ allowed: true, remaining: 5, limit: 10 })
    expect(allowed['Retry-After']).toBeUndefined()
  })
})

// ─── checkRateLimit integration ───────────────────────────────────────────────

describe('checkRateLimit', () => {
  beforeEach(async () => {
    const { rateLimiterStore } = await import('@/lib/rate-limit')
    rateLimiterStore.reset()
  })

  it('uses default options (100 req/60s)', async () => {
    const { checkRateLimit } = await import('@/lib/rate-limit')
    const req = new NextRequest('http://localhost/api/test', {
      headers: { 'x-forwarded-for': '10.0.0.1' },
    })
    const result = checkRateLimit(req)
    expect(result.allowed).toBe(true)
    expect(result.limit).toBe(100)
  })

  it('respects custom limit and window', async () => {
    const { checkRateLimit, rateLimiterStore } = await import('@/lib/rate-limit')
    const req = new NextRequest('http://localhost/api/test', {
      headers: { 'x-forwarded-for': '10.0.0.2' },
    })
    for (let i = 0; i < 3; i++) {
      checkRateLimit(req, { limit: 3, windowSec: 60 })
    }
    const blocked = checkRateLimit(req, { limit: 3, windowSec: 60 })
    expect(blocked.allowed).toBe(false)
    expect(rateLimiterStore.size).toBeGreaterThan(0)
  })
})

// ─── getTierForPath (M189) ────────────────────────────────────────────────────

describe('getTierForPath', () => {
  it('returns expensive for exact expensive route', async () => {
    const { getTierForPath } = await import('@/lib/rate-limit')
    expect(getTierForPath('/api/delegations/[id]/execute')).toBe('expensive')
  })

  it('returns expensive for dynamic segment in expensive route', async () => {
    const { getTierForPath } = await import('@/lib/rate-limit')
    expect(getTierForPath('/api/delegations/abc123/execute')).toBe('expensive')
  })

  it('returns standard for unmatched route', async () => {
    const { getTierForPath } = await import('@/lib/rate-limit')
    expect(getTierForPath('/api/delegations')).toBe('standard')
  })

  it('returns auth for auth routes', async () => {
    const { getTierForPath } = await import('@/lib/rate-limit')
    expect(getTierForPath('/api/auth/signin')).toBe('auth')
  })

  it('returns expensive for critic-review route with dynamic id', async () => {
    const { getTierForPath } = await import('@/lib/rate-limit')
    expect(getTierForPath('/api/delegations/xyz/critic-review')).toBe('expensive')
  })

  it('returns expensive for research-run route with dynamic id', async () => {
    const { getTierForPath } = await import('@/lib/rate-limit')
    expect(getTierForPath('/api/project-briefs/brief-42/research-run')).toBe('expensive')
  })

  it('returns standard for unknown api routes', async () => {
    const { getTierForPath } = await import('@/lib/rate-limit')
    expect(getTierForPath('/api/settings')).toBe('standard')
    expect(getTierForPath('/api/connectors')).toBe('standard')
  })
})
