import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from './route'
import type { Delegation } from '@/lib/models/delegation'

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeDelegation(overrides: Partial<Delegation> = {}): Delegation {
  return {
    id: 'del-001',
    title: 'Test Delegation',
    status: 'completed',
    executionRoute: 'local-agent',
    costEstimateUsd: 0.05,
    actualCostUsd: 0.03,
    createdAt: '2026-05-01T10:00:00.000Z',
    updatedAt: '2026-05-01T11:00:00.000Z',
    contract: {
      id: 'con-001',
      workItemId: 'FP-123',
      goal: 'Write unit tests',
      context: 'Testing context',
      riskClass: 'A',
      maxBudgetUsd: 1.0,
      allowedTools: ['read', 'write'],
      branchStrategy: 'feature',
      requiresApproval: false,
      privacyMode: 'local',
      definitionOfDone: ['Tests green'],
      createdAt: '2026-05-01T10:00:00.000Z',
    },
    ...overrides,
  }
}

const completedDelegation = makeDelegation({ id: 'del-001', status: 'completed', createdAt: '2026-05-01T10:00:00.000Z' })
const failedDelegation = makeDelegation({ id: 'del-002', status: 'failed', createdAt: '2026-05-02T10:00:00.000Z' })
const runningDelegation = makeDelegation({ id: 'del-003', status: 'running', createdAt: '2026-05-03T10:00:00.000Z' })
const quotedTitleDelegation = makeDelegation({
  id: 'del-004',
  status: 'completed',
  title: 'He said "hello, world"',
  createdAt: '2026-05-04T10:00:00.000Z',
})

const mockDelegations: Delegation[] = [
  completedDelegation,
  failedDelegation,
  runningDelegation,
  quotedTitleDelegation,
]

// ── Mock fs module ─────────────────────────────────────────────────────────────

vi.mock('fs', () => ({
  default: {
    readFileSync: vi.fn(() => JSON.stringify(mockDelegations)),
    existsSync: vi.fn(() => true),
  },
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(params: Record<string, string> = {}): Request {
  const url = new URL('http://localhost/api/delegations/export')
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return new Request(url.toString())
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/delegations/export', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('format=csv returns Content-Type text/csv', async () => {
    const res = await GET(makeRequest({ format: 'csv' }))
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('text/csv')
  })

  it('format=json returns Content-Type application/json', async () => {
    const res = await GET(makeRequest({ format: 'json' }))
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('application/json')
  })

  it('status=completed returns only completed delegations', async () => {
    const res = await GET(makeRequest({ format: 'json', status: 'completed' }))
    expect(res.status).toBe(200)
    const data = await res.json() as Delegation[]
    expect(Array.isArray(data)).toBe(true)
    expect(data.every(d => d.status === 'completed')).toBe(true)
    expect(data.some(d => d.status === 'failed')).toBe(false)
    expect(data.some(d => d.status === 'running')).toBe(false)
  })

  it('from filter returns only delegations on or after the given date', async () => {
    // from=2026-05-03 should include del-003 and del-004, exclude del-001 and del-002
    const res = await GET(makeRequest({ format: 'json', from: '2026-05-03' }))
    expect(res.status).toBe(200)
    const data = await res.json() as Delegation[]
    expect(data.some(d => d.id === 'del-001')).toBe(false)
    expect(data.some(d => d.id === 'del-002')).toBe(false)
    expect(data.some(d => d.id === 'del-003')).toBe(true)
    expect(data.some(d => d.id === 'del-004')).toBe(true)
  })

  it('CSV response has the correct header row', async () => {
    const res = await GET(makeRequest({ format: 'csv' }))
    const text = await res.text()
    const firstLine = text.split('\n')[0]
    expect(firstLine).toBe(
      'id,title,goal,status,riskClass,route,workItemId,briefTitle,createdAt,startedAt,completedAt,durationMin,actualCostUsd,tokenCount,prUrl,prState,prMergedAt'
    )
  })

  it('CSV includes goal and durationMin columns', async () => {
    const withTiming = makeDelegation({
      id: 'del-005',
      status: 'completed',
      startedAt: '2026-05-01T10:05:00.000Z',
      completedAt: '2026-05-01T10:35:00.000Z',
    })
    const { default: fs } = await import('fs')
    vi.mocked(fs.readFileSync).mockReturnValueOnce(JSON.stringify([withTiming]))
    const res = await GET(makeRequest({ format: 'csv' }))
    const text = await res.text()
    const rows = text.split('\n')
    const dataRow = rows[1]
    // durationMin = (10:35 - 10:05) = 30 minutes
    expect(dataRow).toContain(',30,')
    // goal should be present
    expect(dataRow).toContain('Write unit tests')
  })

  it('CSV escapes double-quotes in field values', async () => {
    // Only export the row with quoted title to keep the assertion simple
    const res = await GET(makeRequest({ format: 'csv', status: 'completed' }))
    const text = await res.text()
    // The title 'He said "hello, world"' should be escaped to '"He said ""hello, world"""'
    expect(text).toContain('"He said ""hello, world"""')
  })

  it('to filter returns only delegations on or before the given date (inclusive end of day)', async () => {
    // to=2026-05-02 should include del-001 and del-002, exclude del-003 and del-004
    const res = await GET(makeRequest({ format: 'json', to: '2026-05-02' }))
    expect(res.status).toBe(200)
    const data = await res.json() as Delegation[]
    expect(data.some(d => d.id === 'del-001')).toBe(true)
    expect(data.some(d => d.id === 'del-002')).toBe(true)
    expect(data.some(d => d.id === 'del-003')).toBe(false)
    expect(data.some(d => d.id === 'del-004')).toBe(false)
  })

  it('combining from and to returns the intersection', async () => {
    // from=2026-05-02, to=2026-05-03 → del-002 and del-003 only
    const res = await GET(makeRequest({ format: 'json', from: '2026-05-02', to: '2026-05-03' }))
    expect(res.status).toBe(200)
    const data = await res.json() as Delegation[]
    expect(data.some(d => d.id === 'del-001')).toBe(false)
    expect(data.some(d => d.id === 'del-002')).toBe(true)
    expect(data.some(d => d.id === 'del-003')).toBe(true)
    expect(data.some(d => d.id === 'del-004')).toBe(false)
  })

  it('invalid from date returns 400', async () => {
    const res = await GET(makeRequest({ format: 'json', from: 'not-a-date' }))
    expect(res.status).toBe(400)
    const body = await res.json() as { error: string }
    expect(body.error).toMatch(/invalid/i)
  })

  it('invalid to date returns 400', async () => {
    const res = await GET(makeRequest({ format: 'json', to: 'banana' }))
    expect(res.status).toBe(400)
    const body = await res.json() as { error: string }
    expect(body.error).toMatch(/invalid/i)
  })

  it('invalid format returns 400', async () => {
    const res = await GET(makeRequest({ format: 'xml' }))
    expect(res.status).toBe(400)
    const body = await res.json() as { error: string }
    expect(body.error).toMatch(/invalid format/i)
  })

  it('invalid status returns 400', async () => {
    const res = await GET(makeRequest({ format: 'json', status: 'banana' }))
    expect(res.status).toBe(400)
  })

  it('CSV includes prUrl, prState, prMergedAt columns', async () => {
    const withPR = makeDelegation({
      id: 'del-006',
      status: 'completed',
      summaryReport: {
        keyPoints: [],
        changes: [],
        timeTakenMinutes: 5,
        prUrl: 'https://github.com/org/repo/pull/42',
        prState: 'merged',
        prMergedAt: '2026-05-01T12:00:00.000Z',
      },
    })
    const { default: fs } = await import('fs')
    vi.mocked(fs.readFileSync).mockReturnValueOnce(JSON.stringify([withPR]))
    const res = await GET(makeRequest({ format: 'csv' }))
    const text = await res.text()
    expect(text).toContain('https://github.com/org/repo/pull/42')
    expect(text).toContain(',merged,')
    expect(text).toContain('2026-05-01T12:00:00.000Z')
  })
})
