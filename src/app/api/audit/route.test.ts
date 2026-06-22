/**
 * @vitest-environment node
 *
 * Tests for GET /api/audit
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AuditEntry } from '@/lib/audit'

// ── Audit mock ─────────────────────────────────────────────────────────────────

const getAuditLog   = vi.fn<(a?: number, b?: string) => AuditEntry[]>()
const getAuditStats = vi.fn<() => { total: number; last24h: number; byAction: Record<string, number> }>()

vi.mock('@/lib/audit', () => ({ getAuditLog, getAuditStats }))

// ── Fixture ────────────────────────────────────────────────────────────────────

function makeEntry(overrides: Partial<AuditEntry> = {}): AuditEntry {
  return {
    id: 'aud-001',
    action: 'delegation.created',
    entityId: 'del-001',
    entityType: 'delegation',
    actor: 'user-1',
    createdAt: '2026-05-01T10:00:00.000Z',
    ...overrides,
  }
}

function makeRequest(url: string) {
  const { NextRequest } = require('next/server') as typeof import('next/server')
  return new NextRequest(url)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/audit', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns audit log entries', async () => {
    const entries = [makeEntry({ id: 'aud-001' }), makeEntry({ id: 'aud-002' })]
    getAuditLog.mockReturnValueOnce(entries)
    const { GET } = await import('./route')
    const res = await GET(makeRequest('http://localhost/api/audit'))
    expect(res.status).toBe(200)
    const body = await res.json() as AuditEntry[]
    expect(body).toHaveLength(2)
    expect(getAuditLog).toHaveBeenCalledWith(50, undefined)
  })

  it('passes custom limit from query param', async () => {
    getAuditLog.mockReturnValueOnce([])
    const { GET } = await import('./route')
    await GET(makeRequest('http://localhost/api/audit?limit=10'))
    expect(getAuditLog).toHaveBeenCalledWith(10, undefined)
  })

  it('filters by entityId when provided', async () => {
    getAuditLog.mockReturnValueOnce([makeEntry({ entityId: 'del-001' })])
    const { GET } = await import('./route')
    await GET(makeRequest('http://localhost/api/audit?entityId=del-001'))
    expect(getAuditLog).toHaveBeenCalledWith(50, 'del-001')
  })

  it('returns stats when ?stats=true', async () => {
    const stats = { total: 42, last24h: 5, byAction: { 'delegation.created': 3 } }
    getAuditStats.mockReturnValueOnce(stats)
    const { GET } = await import('./route')
    const res = await GET(makeRequest('http://localhost/api/audit?stats=true'))
    expect(res.status).toBe(200)
    const body = await res.json() as typeof stats
    expect(body.total).toBe(42)
    expect(body.last24h).toBe(5)
    expect(getAuditLog).not.toHaveBeenCalled()
  })
})
