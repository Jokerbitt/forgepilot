import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ProcessingRecord } from '@/lib/dsgvo/processing-ledger'

// ─── fs mock ──────────────────────────────────────────────────────────────────

let mockLedgerContent = '[]'
const fsMock = {
  existsSync: vi.fn(() => true),
  readFileSync: (_p: string) => mockLedgerContent,
  writeFileSync: vi.fn(),
  renameSync: vi.fn(),
  mkdirSync: vi.fn(),
}
vi.mock('fs', () => ({ default: fsMock, ...fsMock }))

// Supabase not available in tests
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => null }))
vi.mock('@/db/index', () => ({ isDatabaseConfigured: () => false }))

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeRecord(overrides: Partial<ProcessingRecord> = {}): ProcessingRecord {
  return {
    id:           'test-id',
    purpose:      'Test purpose',
    dataTypes:    ['user_input'],
    processor:    'anthropic',
    legalBasis:   'legitimate-interest',
    piiDetected:  false,
    piiCategories: [],
    piiRedacted:  false,
    piiCount:     0,
    dataResidency: 'eu',
    providerId:   'anthropic',
    retentionDays: 1825,
    processedAt:  new Date().toISOString(),
    ...overrides,
  }
}

// ─── tests ────────────────────────────────────────────────────────────────────

describe('GET /api/dsgvo/stats', () => {
  beforeEach(() => {
    mockLedgerContent = '[]'
    vi.resetModules()
  })

  it('returns zero stats when ledger is empty', async () => {
    const { GET } = await import('./route')
    const res = await GET()
    const data = await res.json() as { stats: { total: number; piiDetected: number }, records: unknown[] }

    expect(data.stats.total).toBe(0)
    expect(data.stats.piiDetected).toBe(0)
    expect(data.records).toHaveLength(0)
  })

  it('counts total records correctly', async () => {
    mockLedgerContent = JSON.stringify([makeRecord(), makeRecord({ id: 'id-2' }), makeRecord({ id: 'id-3' })])
    vi.resetModules()
    const { GET } = await import('./route')
    const res = await GET()
    const data = await res.json() as { stats: { total: number } }

    expect(data.stats.total).toBe(3)
  })

  it('counts PII detected and redacted', async () => {
    const records = [
      makeRecord({ id: '1', piiDetected: true, piiRedacted: true, piiCount: 2 }),
      makeRecord({ id: '2', piiDetected: true, piiRedacted: false, piiCount: 1 }),
      makeRecord({ id: '3', piiDetected: false, piiRedacted: false, piiCount: 0 }),
    ]
    mockLedgerContent = JSON.stringify(records)
    vi.resetModules()
    const { GET } = await import('./route')
    const res = await GET()
    const data = await res.json() as { stats: { piiDetected: number; piiRedacted: number } }

    expect(data.stats.piiDetected).toBe(2)
    expect(data.stats.piiRedacted).toBe(1)
  })

  it('breaks down by provider', async () => {
    const records = [
      makeRecord({ id: '1', processor: 'anthropic' }),
      makeRecord({ id: '2', processor: 'anthropic' }),
      makeRecord({ id: '3', processor: 'ollama' }),
    ]
    mockLedgerContent = JSON.stringify(records)
    vi.resetModules()
    const { GET } = await import('./route')
    const res = await GET()
    const data = await res.json() as { stats: { byProvider: Record<string, number> } }

    expect(data.stats.byProvider.anthropic).toBe(2)
    expect(data.stats.byProvider.ollama).toBe(1)
  })

  it('breaks down by data residency', async () => {
    const records = [
      makeRecord({ id: '1', dataResidency: 'eu' }),
      makeRecord({ id: '2', dataResidency: 'eu' }),
      makeRecord({ id: '3', dataResidency: 'us' }),
      makeRecord({ id: '4', dataResidency: 'local' }),
    ]
    mockLedgerContent = JSON.stringify(records)
    vi.resetModules()
    const { GET } = await import('./route')
    const res = await GET()
    const data = await res.json() as { stats: { byResidency: Record<string, number> } }

    expect(data.stats.byResidency.eu).toBe(2)
    expect(data.stats.byResidency.us).toBe(1)
    expect(data.stats.byResidency.local).toBe(1)
  })

  it('counts last24h records correctly', async () => {
    const recentTs = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()  // 2h ago
    const oldTs    = new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString() // 30h ago
    const records = [
      makeRecord({ id: '1', processedAt: recentTs }),
      makeRecord({ id: '2', processedAt: recentTs }),
      makeRecord({ id: '3', processedAt: oldTs }),
    ]
    mockLedgerContent = JSON.stringify(records)
    vi.resetModules()
    const { GET } = await import('./route')
    const res = await GET()
    const data = await res.json() as { stats: { last24h: number } }

    expect(data.stats.last24h).toBe(2)
  })

  it('returns up to 50 records in records array', async () => {
    const records = Array.from({ length: 60 }, (_, i) => makeRecord({ id: `id-${i}` }))
    mockLedgerContent = JSON.stringify(records)
    vi.resetModules()
    const { GET } = await import('./route')
    const res = await GET()
    const data = await res.json() as { stats: { total: number }; records: unknown[] }

    expect(data.stats.total).toBe(60)     // full count
    expect(data.records.length).toBe(50)  // limited to 50 in response
  })

  it('response has correct shape', async () => {
    vi.resetModules()
    const { GET } = await import('./route')
    const res = await GET()
    const data = await res.json() as { stats: unknown; records: unknown }

    expect(data).toHaveProperty('stats')
    expect(data).toHaveProperty('records')
    expect(typeof (data.stats as Record<string, unknown>).total).toBe('number')
  })
})
