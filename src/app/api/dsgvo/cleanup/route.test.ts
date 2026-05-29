import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ProcessingRecord } from '@/lib/dsgvo/processing-ledger'

// ─── fs mock ──────────────────────────────────────────────────────────────────

let mockLedgerContent = '[]'
let writtenLedger: ProcessingRecord[] | null = null

const fsMock = {
  existsSync: vi.fn(() => true),
  readFileSync: (_p: string) => mockLedgerContent,
  writeFileSync: vi.fn((p: string, data: string) => {
    if (p.includes('processing-ledger.json')) {
      writtenLedger = JSON.parse(data) as ProcessingRecord[]
    }
  }),
  renameSync: vi.fn((tmp: string, dest: string) => {
    // simulate rename: the written tmp content becomes the file content
    if (writtenLedger !== null) {
      mockLedgerContent = JSON.stringify(writtenLedger)
    }
    void tmp; void dest
  }),
  mkdirSync: vi.fn(),
}
vi.mock('fs', () => ({ default: fsMock, ...fsMock }))
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

describe('POST /api/dsgvo/cleanup', () => {
  beforeEach(() => {
    mockLedgerContent = '[]'
    writtenLedger = null
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('returns { deleted: 0 } when ledger is empty', async () => {
    const { POST } = await import('./route')
    const res = await POST()
    const data = await res.json() as { deleted: number }

    expect(data.deleted).toBe(0)
  })

  it('does not delete records within retention period', async () => {
    // Recent record — well within 1825-day retention
    const record = makeRecord({ id: 'keep', processedAt: new Date().toISOString(), retentionDays: 1825 })
    mockLedgerContent = JSON.stringify([record])
    vi.resetModules()
    const { POST } = await import('./route')
    const res = await POST()
    const data = await res.json() as { deleted: number }

    expect(data.deleted).toBe(0)
  })

  it('deletes records past their retention period', async () => {
    // Expired record: 6 years ago with 5-year retention
    const expiredDate = new Date(Date.now() - 6 * 365 * 24 * 60 * 60 * 1000).toISOString()
    const expired = makeRecord({ id: 'expired', processedAt: expiredDate, retentionDays: 1825 })
    const fresh   = makeRecord({ id: 'fresh',   processedAt: new Date().toISOString(), retentionDays: 1825 })
    mockLedgerContent = JSON.stringify([expired, fresh])
    vi.resetModules()
    const { POST } = await import('./route')
    const res = await POST()
    const data = await res.json() as { deleted: number }

    expect(data.deleted).toBe(1)
  })

  it('returns 200 JSON response', async () => {
    vi.resetModules()
    const { POST } = await import('./route')
    const res = await POST()

    expect(res.status).toBe(200)
    const data = await res.json() as { deleted: number }
    expect(typeof data.deleted).toBe('number')
  })
})
