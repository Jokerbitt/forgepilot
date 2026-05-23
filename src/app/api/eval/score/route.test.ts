import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/eval/harness', () => ({
  scoreOutput: vi.fn(),
  saveEvalResult: vi.fn(),
  detectRegression: vi.fn(),
  getEvalCase: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/eval/score', () => {
  it('scores output and returns grade', async () => {
    const { getEvalCase, scoreOutput, saveEvalResult, detectRegression } = await import('@/lib/eval/harness')

    vi.mocked(getEvalCase).mockReturnValue({
      id: 'case-1',
      name: 'Auth test',
      acceptanceCriteria: { minScore: 0.7 },
    } as unknown as ReturnType<typeof getEvalCase>)

    vi.mocked(scoreOutput).mockReturnValue({
      caseId: 'case-1',
      score: 0.85,
      grade: 'B',
      passed: true,
      details: {},
    } as unknown as ReturnType<typeof scoreOutput>)

    vi.mocked(detectRegression).mockReturnValue(null)
    vi.mocked(saveEvalResult).mockResolvedValue(undefined)

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/eval/score', {
      method: 'POST',
      body: JSON.stringify({ caseId: 'case-1', agentOutput: 'Implemented auth.' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    const body = await res.json() as { result: { overallGrade: string } }

    expect(res.status).toBe(200)
    expect(body.result.overallGrade).toBe('B')
  })

  it('returns 404 when eval case not found', async () => {
    const { getEvalCase } = await import('@/lib/eval/harness')
    vi.mocked(getEvalCase).mockReturnValue(undefined as ReturnType<typeof getEvalCase>)

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/eval/score', {
      method: 'POST',
      body: JSON.stringify({ caseId: 'unknown-case', agentOutput: 'Output here.' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(404)
  })

  it('returns 400 when required fields missing', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/eval/score', {
      method: 'POST',
      body: JSON.stringify({ caseId: 'case-1' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
