/**
 * @vitest-environment node
 *
 * Tests for GET / POST / DELETE /api/eval
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { EvalCase, EvalResult, EvalAlert } from '@/lib/eval/harness'

// ── Harness mocks ──────────────────────────────────────────────────────────────

const listEvalCases    = vi.fn<[], EvalCase[]>()
const listEvalResults  = vi.fn<[string?], EvalResult[]>()
const upsertEvalCase   = vi.fn<[Partial<EvalCase>], EvalCase>()
const deleteEvalCase   = vi.fn<[string], void>()
const listEvalAlerts   = vi.fn<[], EvalAlert[]>()
const acknowledgeAlert = vi.fn<[string], void>()

vi.mock('@/lib/eval/harness', () => ({
  listEvalCases,
  listEvalResults,
  upsertEvalCase,
  deleteEvalCase,
  listEvalAlerts,
  acknowledgeAlert,
}))

// ── Fixtures ───────────────────────────────────────────────────────────────────

function makeCase(overrides: Partial<EvalCase> = {}): EvalCase {
  return {
    id: 'case-001',
    title: 'Test Case',
    prompt: 'Prompt with at least ten characters',
    acceptanceCriteria: ['Output is correct'],
    tags: [],
    active: true,
    createdAt: '2026-05-01T10:00:00.000Z',
    ...overrides,
  }
}

function makeRequest(url: string) {
  const { NextRequest } = require('next/server') as typeof import('next/server')
  return new NextRequest(url)
}

function makePostRequest(body: unknown) {
  const { NextRequest } = require('next/server') as typeof import('next/server')
  return new NextRequest('http://localhost/api/eval', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/eval', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns eval cases by default', async () => {
    listEvalCases.mockReturnValueOnce([makeCase()])
    const { GET } = await import('./route')
    const res = await GET(makeRequest('http://localhost/api/eval'))
    expect(res.status).toBe(200)
    const body = await res.json() as EvalCase[]
    expect(body).toHaveLength(1)
    expect(listEvalCases).toHaveBeenCalledOnce()
  })

  it('returns results when ?type=results', async () => {
    listEvalResults.mockReturnValueOnce([])
    const { GET } = await import('./route')
    const res = await GET(makeRequest('http://localhost/api/eval?type=results'))
    expect(res.status).toBe(200)
    expect(listEvalResults).toHaveBeenCalledWith(undefined)
  })

  it('passes caseId to listEvalResults when provided', async () => {
    listEvalResults.mockReturnValueOnce([])
    const { GET } = await import('./route')
    await GET(makeRequest('http://localhost/api/eval?type=results&caseId=case-001'))
    expect(listEvalResults).toHaveBeenCalledWith('case-001')
  })

  it('returns alerts when ?type=alerts', async () => {
    listEvalAlerts.mockReturnValueOnce([])
    const { GET } = await import('./route')
    const res = await GET(makeRequest('http://localhost/api/eval?type=alerts'))
    expect(res.status).toBe(200)
    expect(listEvalAlerts).toHaveBeenCalledOnce()
  })
})

describe('POST /api/eval', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('creates eval case and returns it', async () => {
    const created = makeCase({ id: 'case-new' })
    upsertEvalCase.mockReturnValueOnce(created)
    const { POST } = await import('./route')
    const res = await POST(
      makePostRequest({
        title: 'New Case',
        prompt: 'A prompt that is at least ten characters long',
        acceptanceCriteria: ['It works correctly'],
      }),
    )
    expect(res.status).toBe(200)
    const body = await res.json() as EvalCase
    expect(body.id).toBe('case-new')
    expect(upsertEvalCase).toHaveBeenCalledOnce()
  })

  it('returns 400 when prompt is too short', async () => {
    const { POST } = await import('./route')
    const res = await POST(
      makePostRequest({
        title: 'Short',
        prompt: 'Too short',
        acceptanceCriteria: ['ok'],
      }),
    )
    expect(res.status).toBe(400)
    expect(upsertEvalCase).not.toHaveBeenCalled()
  })

  it('acknowledges alert when action=acknowledge', async () => {
    const { POST } = await import('./route')
    const res = await POST(makePostRequest({ action: 'acknowledge', alertId: 'alert-001' }))
    expect(res.status).toBe(200)
    const body = await res.json() as { ok: boolean }
    expect(body.ok).toBe(true)
    expect(acknowledgeAlert).toHaveBeenCalledWith('alert-001')
    expect(upsertEvalCase).not.toHaveBeenCalled()
  })
})

describe('DELETE /api/eval', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 400 when caseId is missing', async () => {
    const { DELETE } = await import('./route')
    const res = await DELETE(makeRequest('http://localhost/api/eval'))
    expect(res.status).toBe(400)
    expect(deleteEvalCase).not.toHaveBeenCalled()
  })

  it('deletes case and returns ok', async () => {
    const { DELETE } = await import('./route')
    const res = await DELETE(makeRequest('http://localhost/api/eval?caseId=case-001'))
    expect(res.status).toBe(200)
    const body = await res.json() as { ok: boolean }
    expect(body.ok).toBe(true)
    expect(deleteEvalCase).toHaveBeenCalledWith('case-001')
  })
})
