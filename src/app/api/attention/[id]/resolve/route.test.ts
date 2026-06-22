/**
 * @vitest-environment node
 *
 * Tests for POST /api/attention/[id]/resolve
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AttentionItem } from '@/lib/models/attention'

// ── Store mock ─────────────────────────────────────────────────────────────────

const resolveAttentionItem = vi.fn<(a: string, b: string) => AttentionItem | null>()

vi.mock('@/lib/attention/store', () => ({ resolveAttentionItem }))

// ── Tests ─────────────────────────────────────────────────────────────────────

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

describe('POST /api/attention/[id]/resolve', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 404 when item not found', async () => {
    resolveAttentionItem.mockReturnValueOnce(null)
    const { POST } = await import('./route')
    const res = await POST(new Request('http://localhost/api/attention/missing/resolve', { method: 'POST' }), makeParams('missing'))
    expect(res.status).toBe(404)
  })

  it('resolves item and returns 200', async () => {
    resolveAttentionItem.mockReturnValueOnce({
      id: 'att-001',
      type: 'escalation',
      severity: 'warning',
      title: 'Resolved item',
      body: '',
      createdAt: '2026-05-01T10:00:00.000Z',
      resolvedAt: new Date().toISOString(),
      resolvedBy: 'user',
    })
    const { POST } = await import('./route')
    const res = await POST(new Request('http://localhost/api/attention/att-001/resolve', { method: 'POST' }), makeParams('att-001'))
    expect(res.status).toBe(200)
    const body = await res.json() as { resolved: boolean }
    expect(body.resolved).toBe(true)
    expect(resolveAttentionItem).toHaveBeenCalledWith('att-001', 'user')
  })
})
