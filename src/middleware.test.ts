import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('next-auth/jwt', () => ({
  getToken: vi.fn(),
}))

vi.mock('@/lib/auth/config', () => ({
  isForgePilotAuthEnabled: vi.fn(),
  isAuthConfigured: vi.fn(),
  shouldProtectPath: vi.fn(),
  isPublicOperationalPath: vi.fn(),
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimiterStore: { check: vi.fn().mockReturnValue({ allowed: true, remaining: 99, limit: 100 }) },
  buildRateLimitHeaders: vi.fn().mockReturnValue({}),
  getTierForPath: vi.fn().mockReturnValue('standard'),
  RATE_LIMIT_TIERS: { standard: { limit: 100, windowMs: 60_000 } },
}))

import { getToken } from 'next-auth/jwt'
import {
  isForgePilotAuthEnabled,
  isAuthConfigured,
  shouldProtectPath,
  isPublicOperationalPath,
} from '@/lib/auth/config'
import { rateLimiterStore } from '@/lib/rate-limit'
import { middleware } from './middleware'

const mockGetToken = vi.mocked(getToken)
const mockAuthEnabled = vi.mocked(isForgePilotAuthEnabled)
const mockAuthConfigured = vi.mocked(isAuthConfigured)
const mockShouldProtect = vi.mocked(shouldProtectPath)
const mockIsPublicOperational = vi.mocked(isPublicOperationalPath)
const mockRateLimitCheck = vi.mocked(rateLimiterStore.check)

type NextRequestInit = ConstructorParameters<typeof NextRequest>[1]

function makeRequest(url: string, options?: NextRequestInit): NextRequest {
  return new NextRequest(url, options)
}

beforeEach(() => {
  vi.clearAllMocks()
  // Defaults: auth disabled (simplest path)
  mockAuthEnabled.mockReturnValue(false)
  mockAuthConfigured.mockReturnValue(true)
  mockShouldProtect.mockReturnValue(false)
  mockIsPublicOperational.mockReturnValue(false)
  mockRateLimitCheck.mockReturnValue({ allowed: true, remaining: 99, limit: 100 })
  delete process.env.FORGEPILOT_API_KEY
})

afterEach(() => {
  delete process.env.FORGEPILOT_API_KEY
})

// ─── Request ID ───────────────────────────────────────────────────────────────

describe('x-request-id header', () => {
  it('generates a new request-id when none is provided', async () => {
    const req = makeRequest('http://localhost/api/health')
    const res = await middleware(req)
    expect(res.headers.get('x-request-id')).toBeTruthy()
  })

  it('honours a valid incoming request-id', async () => {
    const req = makeRequest('http://localhost/api/health', {
      headers: { 'x-request-id': 'test-id-12345678' },
    })
    const res = await middleware(req)
    expect(res.headers.get('x-request-id')).toBe('test-id-12345678')
  })

  it('replaces an invalid incoming request-id with a fresh one', async () => {
    const req = makeRequest('http://localhost/api/health', {
      headers: { 'x-request-id': '!invalid!' },
    })
    const res = await middleware(req)
    const id = res.headers.get('x-request-id')
    expect(id).toBeTruthy()
    expect(id).not.toBe('!invalid!')
  })
})

// ─── Body size guard ──────────────────────────────────────────────────────────

describe('body size guard', () => {
  it('returns 413 when content-length exceeds 10 MB', async () => {
    const req = makeRequest('http://localhost/api/delegations', {
      method: 'POST',
      headers: { 'content-length': String(11 * 1024 * 1024) },
    })
    const res = await middleware(req)
    expect(res.status).toBe(413)
  })

  it('allows POST within size limit', async () => {
    const req = makeRequest('http://localhost/api/delegations', {
      method: 'POST',
      headers: { 'content-length': '512' },
    })
    const res = await middleware(req)
    expect(res.status).not.toBe(413)
  })
})

// ─── Rate limiting ────────────────────────────────────────────────────────────

describe('rate limiting', () => {
  it('returns 429 when the rate limit is exceeded on a POST', async () => {
    mockRateLimitCheck.mockReturnValue({ allowed: false, retryAfter: 30, remaining: 0, limit: 100 })
    const req = makeRequest('http://localhost/api/delegations', {
      method: 'POST',
      headers: { 'x-forwarded-for': '1.2.3.4' },
    })
    const res = await middleware(req)
    expect(res.status).toBe(429)
    const body = await res.json() as { error: string; retryAfter: number }
    expect(body.error).toBe('Too Many Requests')
    expect(body.retryAfter).toBe(30)
  })

  it('does not rate-limit GET requests', async () => {
    mockRateLimitCheck.mockReturnValue({ allowed: false, retryAfter: 30, remaining: 0, limit: 100 })
    const req = makeRequest('http://localhost/api/delegations')
    const res = await middleware(req)
    // Rate limiter check should NOT be called for GET
    expect(mockRateLimitCheck).not.toHaveBeenCalled()
    expect(res.status).not.toBe(429)
  })
})

// ─── API Key auth ─────────────────────────────────────────────────────────────

describe('API key authentication', () => {
  beforeEach(() => {
    process.env.FORGEPILOT_API_KEY = 'secret-key-1234'
  })

  it('returns 401 when API key is missing', async () => {
    const req = makeRequest('http://localhost/api/delegations', { method: 'GET' })
    const res = await middleware(req)
    expect(res.status).toBe(401)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 401 when API key is wrong', async () => {
    const req = makeRequest('http://localhost/api/delegations', {
      headers: { authorization: 'Bearer wrong-key' },
    })
    const res = await middleware(req)
    expect(res.status).toBe(401)
  })

  it('allows through with correct API key', async () => {
    const req = makeRequest('http://localhost/api/delegations', {
      headers: { authorization: 'Bearer secret-key-1234' },
    })
    const res = await middleware(req)
    expect(res.status).not.toBe(401)
  })

  it('bypasses API key check for public operational paths (webhooks)', async () => {
    const req = makeRequest('http://localhost/api/webhooks/github', { method: 'POST' })
    const res = await middleware(req)
    // Should not return 401 from the API key check
    expect(res.status).not.toBe(401)
  })
})

// ─── Session auth ─────────────────────────────────────────────────────────────

describe('session authentication', () => {
  beforeEach(() => {
    mockAuthEnabled.mockReturnValue(true)
    mockAuthConfigured.mockReturnValue(true)
  })

  it('redirects unauthenticated page requests to /login', async () => {
    mockShouldProtect.mockReturnValue(true)
    mockGetToken.mockResolvedValue(null)

    const req = makeRequest('http://localhost/delegations')
    const res = await middleware(req)

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/login')
  })

  it('returns 401 JSON for unauthenticated API requests', async () => {
    mockShouldProtect.mockReturnValue(true)
    mockGetToken.mockResolvedValue(null)

    const req = makeRequest('http://localhost/api/delegations')
    const res = await middleware(req)

    expect(res.status).toBe(401)
    const body = await res.json() as { error: string; authRequired: boolean }
    expect(body.authRequired).toBe(true)
  })

  it('passes authenticated requests through', async () => {
    mockShouldProtect.mockReturnValue(true)
    mockGetToken.mockResolvedValue({ sub: 'user-1', email: 'admin@forgepilot.local' })

    const req = makeRequest('http://localhost/api/delegations')
    const res = await middleware(req)

    expect(res.status).not.toBe(401)
    expect(mockGetToken).toHaveBeenCalledOnce()
  })

  it('redirects to /setup when auth is enabled but not configured', async () => {
    mockAuthConfigured.mockReturnValue(false)
    mockShouldProtect.mockReturnValue(false)
    mockIsPublicOperational.mockReturnValue(false)

    const req = makeRequest('http://localhost/dashboard')
    const res = await middleware(req)

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/setup')
  })

  it('allows public operational paths without auth token', async () => {
    mockIsPublicOperational.mockReturnValue(true)
    mockShouldProtect.mockReturnValue(false)

    const req = makeRequest('http://localhost/api/health')
    const res = await middleware(req)

    expect(res.status).not.toBe(401)
    expect(mockGetToken).not.toHaveBeenCalled()
  })
})
