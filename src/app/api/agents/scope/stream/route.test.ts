/**
 * Tests for GET /api/agents/scope/stream (SSE) — M162
 */

import { describe, it, expect, vi } from 'vitest'

const { mockGetActiveClaims } = vi.hoisted(() => ({
  mockGetActiveClaims: vi.fn(() => []),
}))

vi.mock('@/lib/agents/scope-lock', () => ({
  getActiveClaims: mockGetActiveClaims,
}))

import { GET } from './route'

describe('GET /api/agents/scope/stream', () => {
  it('returns 200 with text/event-stream content type', async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('text/event-stream')
  })

  it('includes cache-control no-cache', async () => {
    const res = await GET()
    expect(res.headers.get('Cache-Control')).toBe('no-cache')
  })

  it('includes X-Accel-Buffering no to disable nginx buffering', async () => {
    const res = await GET()
    expect(res.headers.get('X-Accel-Buffering')).toBe('no')
  })

  it('sends initial claims event in the stream', async () => {
    mockGetActiveClaims.mockReturnValue([
      {
        agentId: 'claude-1',
        agentType: 'backend-engineer',
        milestone: 'M162',
        branch: 'feature/m162',
        filePatterns: ['src/**/*.ts'],
        claimedAt: '2026-05-21T08:00:00.000Z',
        expiresAt: '2026-05-21T10:00:00.000Z',
      },
    ])

    const res = await GET()
    const reader = res.body!.getReader()
    const { value } = await reader.read()
    reader.cancel()

    const text = new TextDecoder().decode(value)
    expect(text).toContain('event: claims')
    expect(text).toContain('"agentId":"claude-1"')
    expect(text).toContain('"count":1')
  })

  it('sends empty claims event when no active claims', async () => {
    mockGetActiveClaims.mockReturnValue([])

    const res = await GET()
    const reader = res.body!.getReader()
    const { value } = await reader.read()
    reader.cancel()

    const text = new TextDecoder().decode(value)
    expect(text).toContain('event: claims')
    expect(text).toContain('"count":0')
    expect(text).toContain('"claims":[]')
  })

  it('returns a ReadableStream as body', async () => {
    const res = await GET()
    expect(res.body).toBeDefined()
    expect(res.body).not.toBeNull()
    // Cancel to clean up timers
    await res.body!.cancel()
  })
})
