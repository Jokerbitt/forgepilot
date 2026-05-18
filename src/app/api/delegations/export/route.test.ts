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
      'id,title,status,riskClass,route,workItemId,createdAt,completedAt,actualCostUsd,tokenCount'
    )
  })

  it('CSV escapes double-quotes in field values', async () => {
    // Only export the row with quoted title to keep the assertion simple
    const res = await GET(makeRequest({ format: 'csv', status: 'completed' }))
    const text = await res.text()
    // The title 'He said "hello, world"' should be escaped to '"He said ""hello, world"""'
    expect(text).toContain('"He said ""hello, world"""')
  })
})
