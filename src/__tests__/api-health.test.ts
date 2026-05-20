/**
 * Tests for GET /api/health
 */

import { describe, it, expect } from 'vitest'

// Import route after any mocks (none needed here — no external deps)
import { GET } from '@/app/api/health/route'

describe('GET /api/health', () => {
  it('returns HTTP 200', async () => {
    const response = await GET()
    expect(response.status).toBe(200)
  })

  it('returns status: ok in the response body', async () => {
    const response = await GET()
    const body = await response.json() as { status: string; timestamp: string }
    expect(body.status).toBe('ok')
  })

  it('includes a timestamp in ISO 8601 format', async () => {
    const response = await GET()
    const body = await response.json() as { status: string; timestamp: string }
    expect(typeof body.timestamp).toBe('string')
    // ISO 8601 check — should parse to a valid date
    expect(Number.isNaN(new Date(body.timestamp).getTime())).toBe(false)
  })

  it('returns Content-Type application/json', async () => {
    const response = await GET()
    expect(response.headers.get('content-type')).toContain('application/json')
  })
})
