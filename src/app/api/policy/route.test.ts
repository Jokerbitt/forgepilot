/**
 * @vitest-environment node
 *
 * Tests for POST /api/policy
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Policy engine mock ─────────────────────────────────────────────────────────

const evaluatePolicy = vi.fn<(a: unknown) => { verdict: 'allow' | 'deny' | 'review'; reason?: string }>()

vi.mock('@/lib/policy/engine', () => ({ evaluatePolicy }))

// ── Tests ─────────────────────────────────────────────────────────────────────

function makePostRequest(body: unknown) {
  const { NextRequest } = require('next/server') as typeof import('next/server')
  return new NextRequest('http://localhost/api/policy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/policy', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 400 when required fields are missing', async () => {
    const { POST } = await import('./route')
    const res = await POST(makePostRequest({}))
    expect(res.status).toBe(400)
    expect(evaluatePolicy).not.toHaveBeenCalled()
  })

  it('returns 200 with allow verdict', async () => {
    evaluatePolicy.mockReturnValueOnce({ verdict: 'allow' })
    const { POST } = await import('./route')
    const res = await POST(
      makePostRequest({ id: 'con-001', goal: 'Implement feature', riskClass: 'A' }),
    )
    expect(res.status).toBe(200)
    const body = await res.json() as { verdict: string }
    expect(body.verdict).toBe('allow')
  })

  it('returns 200 with deny verdict so the UI can render a policy result', async () => {
    evaluatePolicy.mockReturnValueOnce({ verdict: 'deny', reason: 'Risk too high' })
    const { POST } = await import('./route')
    const res = await POST(
      makePostRequest({ id: 'con-001', goal: 'Delete production data', riskClass: 'C' }),
    )
    expect(res.status).toBe(200)
    const body = await res.json() as { verdict: string; reason: string }
    expect(body.verdict).toBe('deny')
    expect(body.reason).toBe('Risk too high')
  })

  it('returns 200 with review verdict', async () => {
    evaluatePolicy.mockReturnValueOnce({ verdict: 'review' })
    const { POST } = await import('./route')
    const res = await POST(
      makePostRequest({ id: 'con-001', goal: 'Complex migration', riskClass: 'B' }),
    )
    expect(res.status).toBe(200)
    const body = await res.json() as { verdict: string }
    expect(body.verdict).toBe('review')
  })
})
