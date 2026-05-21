import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextResponse } from 'next/server'

// Mock next-auth getServerSession before importing requireAuth
vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}))

// Mock the auth options (just needs to exist for the import)
vi.mock('./options', () => ({
  authOptions: {},
}))

import { getServerSession } from 'next-auth'
import { requireAuth } from './require-auth'

const mockGetServerSession = vi.mocked(getServerSession)

describe('requireAuth', () => {
  const originalEnv = process.env.FORGEPILOT_AUTH_DISABLED

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.FORGEPILOT_AUTH_DISABLED
    } else {
      process.env.FORGEPILOT_AUTH_DISABLED = originalEnv
    }
    vi.clearAllMocks()
  })

  it('returns null when FORGEPILOT_AUTH_DISABLED=true (dev bypass)', async () => {
    process.env.FORGEPILOT_AUTH_DISABLED = 'true'

    const result = await requireAuth()

    expect(result).toBeNull()
    // getServerSession must not be called when auth is disabled
    expect(mockGetServerSession).not.toHaveBeenCalled()
  })

  it('returns 401 NextResponse when auth is enabled and there is no session', async () => {
    delete process.env.FORGEPILOT_AUTH_DISABLED
    mockGetServerSession.mockResolvedValueOnce(null)

    const result = await requireAuth()

    expect(result).toBeInstanceOf(NextResponse)
    expect(result?.status).toBe(401)

    const body = await result?.json()
    expect(body).toEqual({ error: 'Unauthorized' })
  })

  it('returns null when auth is enabled and a valid session exists', async () => {
    delete process.env.FORGEPILOT_AUTH_DISABLED
    mockGetServerSession.mockResolvedValueOnce({
      user: { email: 'admin@forgepilot.local' },
      expires: '2099-01-01',
    })

    const result = await requireAuth()

    expect(result).toBeNull()
  })

  it('FORGEPILOT_AUTH_DISABLED=false still enforces auth', async () => {
    process.env.FORGEPILOT_AUTH_DISABLED = 'false'
    mockGetServerSession.mockResolvedValueOnce(null)

    const result = await requireAuth()

    expect(result).toBeInstanceOf(NextResponse)
    expect(result?.status).toBe(401)
  })
})
