import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock fs before importing route ──────────────────────────────────────────
const { mockReadFileSync } = vi.hoisted(() => ({
  mockReadFileSync: vi.fn(() => '[]'),
}))

vi.mock('fs', () => ({
  default: { readFileSync: mockReadFileSync, existsSync: vi.fn(() => true) },
  readFileSync: mockReadFileSync,
  existsSync: vi.fn(() => true),
}))

import { GET } from './route'

function makeDelegation(overrides: {
  id?: string
  status?: string
  updatedAt?: string
  logsCount?: number
} = {}) {
  return {
    id: overrides.id ?? 'del-1',
    title: 'Test',
    status: overrides.status ?? 'running',
    executionRoute: 'local-agent',
    costEstimateUsd: 0,
    createdAt: new Date().toISOString(),
    updatedAt: overrides.updatedAt ?? new Date().toISOString(),
    contract: {
      id: 'c-1', workItemId: 'wi-1', goal: 'Do X', context: '', definitionOfDone: [],
      riskClass: 'A', maxBudgetUsd: 1, allowedTools: [], branchStrategy: 'feature',
      requiresApproval: false, privacyMode: 'local', createdAt: new Date().toISOString(),
    },
    logs: Array.from({ length: overrides.logsCount ?? 0 }, (_, i) => ({
      timestamp: new Date().toISOString(),
      type: 'info' as const,
      message: `Log ${i}`,
    })),
  }
}

describe('GET /api/delegations/live-stream', () => {
  beforeEach(() => {
    mockReadFileSync.mockClear()
    mockReadFileSync.mockReturnValue('[]')
  })

  it('returns HTTP 200', async () => {
    const res = await GET()
    expect(res.status).toBe(200)
  })

  it('sets Content-Type to text/event-stream', async () => {
    const res = await GET()
    expect(res.headers.get('Content-Type')).toContain('text/event-stream')
  })

  it('sets Cache-Control: no-cache', async () => {
    const res = await GET()
    expect(res.headers.get('Cache-Control')).toContain('no-cache')
  })

  it('sets X-Accel-Buffering: no', async () => {
    const res = await GET()
    expect(res.headers.get('X-Accel-Buffering')).toBe('no')
  })

  it('sends initial delegations event for running delegation', async () => {
    mockReadFileSync.mockReturnValue(JSON.stringify([makeDelegation({ status: 'running' })]))

    const res = await GET()
    const reader = res.body!.getReader()
    const { value } = await reader.read()
    const text = new TextDecoder().decode(value)
    reader.cancel()

    expect(text).toContain('event: delegations')
    expect(text).toContain('"count":1')
  })

  it('sends initial empty event when no running delegations', async () => {
    mockReadFileSync.mockReturnValue(JSON.stringify([
      makeDelegation({ status: 'pending' }),
      makeDelegation({ status: 'cancelled' }),
    ]))

    const res = await GET()
    const reader = res.body!.getReader()
    const { value } = await reader.read()
    const text = new TextDecoder().decode(value)
    reader.cancel()

    expect(text).toContain('event: delegations')
    expect(text).toContain('"count":0')
  })

  it('includes recently completed delegations (within 5 min)', async () => {
    const recentUpdatedAt = new Date(Date.now() - 2 * 60 * 1000).toISOString() // 2 min ago
    mockReadFileSync.mockReturnValue(JSON.stringify([
      makeDelegation({ status: 'completed', updatedAt: recentUpdatedAt }),
    ]))

    const res = await GET()
    const reader = res.body!.getReader()
    const { value } = await reader.read()
    const text = new TextDecoder().decode(value)
    reader.cancel()

    expect(text).toContain('"count":1')
  })

  it('excludes completed delegations older than 5 minutes', async () => {
    const oldUpdatedAt = new Date(Date.now() - 10 * 60 * 1000).toISOString() // 10 min ago
    mockReadFileSync.mockReturnValue(JSON.stringify([
      makeDelegation({ status: 'completed', updatedAt: oldUpdatedAt }),
    ]))

    const res = await GET()
    const reader = res.body!.getReader()
    const { value } = await reader.read()
    const text = new TextDecoder().decode(value)
    reader.cancel()

    expect(text).toContain('"count":0')
  })

  it('returns a ReadableStream body', async () => {
    const res = await GET()
    expect(res.body).not.toBeNull()
    // ReadableStream should be lockable
    const reader = res.body!.getReader()
    expect(reader).toBeDefined()
    reader.cancel()
  })
})
