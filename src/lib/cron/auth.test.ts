import { describe, it, expect, vi, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { isCronAuthorized } from './auth'

function makeRequest(authHeader?: string): NextRequest {
  const headers = new Headers()
  if (authHeader !== undefined) {
    headers.set('authorization', authHeader)
  }
  return new NextRequest('http://localhost/api/cron/test', { headers })
}

describe('isCronAuthorized', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns true when secret matches Bearer token', () => {
    vi.stubEnv('CRON_SECRET', 'supersecret')
    const request = makeRequest('Bearer supersecret')
    expect(isCronAuthorized(request, 'test-route')).toBe(true)
  })

  it('returns false when secret does not match', () => {
    vi.stubEnv('CRON_SECRET', 'supersecret')
    const request = makeRequest('Bearer wrong')
    expect(isCronAuthorized(request, 'test-route')).toBe(false)
  })

  it('returns false when Authorization header is missing but secret is set', () => {
    vi.stubEnv('CRON_SECRET', 'supersecret')
    const request = makeRequest()
    expect(isCronAuthorized(request, 'test-route')).toBe(false)
  })

  it('returns true in non-production when no secret is configured', () => {
    vi.stubEnv('CRON_SECRET', '')
    vi.stubEnv('NODE_ENV', 'development')
    const request = makeRequest()
    expect(isCronAuthorized(request, 'test-route')).toBe(true)
  })

  it('returns false in production when no secret is configured', () => {
    vi.stubEnv('CRON_SECRET', '')
    vi.stubEnv('NODE_ENV', 'production')
    const request = makeRequest()
    expect(isCronAuthorized(request, 'test-route')).toBe(false)
  })
})
