import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { ErrorInfo } from '@/lib/models/error'

vi.mock('@/lib/reports/daily-report', () => ({
  buildDailyReport: vi.fn(() => ({
    version: 1,
    generatedAt: '2026-05-21T10:00:00.000Z',
    period: 'daily',
    executiveVerdict: { status: 'green', summary: 'All good.' },
    status: {
      delegations: { total: 0, pending: 0, approved: 0, running: 0, completed: 0, failed: 0, cancelled: 0 },
      projectBriefs: { total: 0, accepted: 0, inReview: 0, draft: 0 },
      quality: { completedDelegations: 0, criticScoresStored: 0, criticCoveragePct: 0, prsCreated: 0, knowledgeCards: 0, knowledgeWritebacks: 0 },
      operations: { openAttentionItems: 0, staleRunningDelegations: 0, storageMode: 'json', authDisabled: false },
    },
    risks: [],
    nextActions: [],
    prompts: [],
    markdown: '# ForgePilot Daily Report\n\n## Executive Verdict\nGREEN: All good.\n',
  })),
}))

vi.mock('@/lib/reports/execute-loop-evidence-store', () => ({
  readExecuteLoopEvidence: vi.fn(() => []),
}))

vi.mock('@/lib/repositories/delegationRepository', () => ({
  createDelegationRepository: vi.fn(() => ({
    listByStatus: vi.fn(async () => []),
  })),
  getDelegationStorageMode: vi.fn(() => 'json'),
  SINGLE_TENANT_USER_ID: 'single-tenant',
}))

vi.mock('@/lib/repositories/knowledgeCardRepository', () => ({
  createKnowledgeCardRepository: vi.fn(() => ({
    listAll: vi.fn(async () => []),
  })),
}))

vi.mock('@/lib/repositories/projectBriefRepository', () => ({
  createProjectBriefRepository: vi.fn(() => ({
    listAll: vi.fn(async () => []),
  })),
}))

vi.mock('@/lib/attention/store', () => ({
  getOpenAttentionItems: vi.fn(() => []),
}))

const mockErrors: ErrorInfo[] = []
vi.mock('@/lib/models/error', async () => {
  const actual = await vi.importActual<typeof import('@/lib/models/error')>('@/lib/models/error')
  return {
    ...actual,
    listErrorInfo: vi.fn(() => mockErrors),
  }
})

function makeRequest(format?: string): NextRequest {
  const url = format
    ? `http://localhost/api/reports/daily?format=${format}`
    : 'http://localhost/api/reports/daily'
  return new NextRequest(url)
}

describe('GET /api/reports/daily — error info integration', () => {
  beforeEach(() => {
    mockErrors.length = 0
  })

  it('includes empty errors array in JSON when no errors recorded', async () => {
    const { GET } = await import('./route')
    const response = await GET(makeRequest())
    expect(response.status).toBe(200)
    const body = await response.json() as Record<string, unknown>
    expect(Array.isArray(body.errors)).toBe(true)
    expect((body.errors as unknown[]).length).toBe(0)
  })

  it('surfaces recorded errors in the JSON response', async () => {
    mockErrors.push({
      id: 'err-test-1',
      message: 'Pipeline timed out after 30s',
      severity: 'high',
      source: 'pipeline',
      occurredAt: '2026-05-21T11:50:00.000Z',
      relatedId: 'del-42',
    })

    const { GET } = await import('./route')
    const response = await GET(makeRequest())
    expect(response.status).toBe(200)
    const body = await response.json() as { errors: ErrorInfo[] }
    expect(body.errors).toHaveLength(1)
    expect(body.errors[0].message).toBe('Pipeline timed out after 30s')
    expect(body.errors[0].severity).toBe('high')
  })

  it('renders an actionable error section in markdown when errors exist', async () => {
    mockErrors.push({
      id: 'err-test-2',
      message: 'Webhook signature verification failed',
      severity: 'critical',
      source: 'webhook',
      occurredAt: '2026-05-21T11:55:00.000Z',
    })

    const { GET } = await import('./route')
    const response = await GET(makeRequest('markdown'))
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/markdown')

    const text = await response.text()
    expect(text).toContain('## Aktuelle Fehlerlage')
    expect(text).toContain('Webhook signature verification failed')
    expect(text).toContain('[CRITICAL]')
    expect(text).toContain('webhook')
  })

  it('renders a helpful empty-state placeholder in markdown when error log is empty', async () => {
    const { GET } = await import('./route')
    const response = await GET(makeRequest('markdown'))
    const text = await response.text()
    expect(text).toContain('## Aktuelle Fehlerlage')
    expect(text).toContain('Keine aktuellen Fehler protokolliert.')
    expect(text).toContain('ohne Fehler-Triage')
  })
})
