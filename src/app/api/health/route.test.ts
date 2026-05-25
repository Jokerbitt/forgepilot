/**
 * @vitest-environment node
 *
 * Tests for GET /api/health
 */
import { describe, it, expect } from 'vitest'

describe('GET /api/health', () => {
  it('returns status ok with timestamp', async () => {
    const { GET } = await import('./route')
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json() as {
      status: string
      timestamp: string
      version: string
      nodeEnv: string
      uptimeSeconds: number
    }
    expect(body.status).toBe('ok')
    expect(typeof body.timestamp).toBe('string')
    expect(new Date(body.timestamp).getFullYear()).toBeGreaterThan(2020)
    expect(typeof body.version).toBe('string')
    expect(typeof body.nodeEnv).toBe('string')
    expect(typeof body.uptimeSeconds).toBe('number')
    expect(body.uptimeSeconds).toBeGreaterThanOrEqual(0)
  })
})
