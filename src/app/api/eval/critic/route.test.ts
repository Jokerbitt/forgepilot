import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/eval/grok-critic', () => ({
  getCriticProviderPlan: vi.fn(),
  runGrokCritic: vi.fn(),
  runGrokCodeReview: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/eval/critic', () => {
  it('returns critic result for delegation evaluation', async () => {
    const { runGrokCritic } = await import('@/lib/eval/grok-critic')
    vi.mocked(runGrokCritic).mockResolvedValue({
      correctnessScore: 85,
      efficiencyScore: 82,
      driftScore: 90,
      overallGrade: 'B',
      criteriaHit: [true, true],
      issues: [],
      verdict: 'PASS',
      reason: 'Looks good',
      providerId: 'xai',
      evaluatedAt: '2024-01-01T00:00:00.000Z',
    })

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      body: JSON.stringify({
        type: 'delegation',
        delegationTitle: 'Fix auth',
        delegationContract: 'Build auth module',
        acceptanceCriteria: ['Tests pass', 'No regressions'],
        agentOutput: 'I implemented the auth module with tests.',
      }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    const body = await res.json() as { correctnessScore: number; verdict: string }

    expect(res.status).toBe(200)
    expect(body.correctnessScore).toBe(85)
    expect(body.verdict).toBe('PASS')
  })

  it('returns 503 when no critic provider available for delegation', async () => {
    const { runGrokCritic, getCriticProviderPlan } = await import('@/lib/eval/grok-critic')
    vi.mocked(runGrokCritic).mockResolvedValue(null as Awaited<ReturnType<typeof runGrokCritic>>)
    vi.mocked(getCriticProviderPlan).mockReturnValue({ mode: 'auto', candidates: [], description: 'No critic providers configured' })

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      body: JSON.stringify({
        type: 'delegation',
        delegationTitle: 'Fix auth',
        delegationContract: 'Build auth',
        acceptanceCriteria: ['Pass'],
        agentOutput: 'Done.',
      }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)

    expect(res.status).toBe(503)
  })

  it('returns code review result', async () => {
    const { runGrokCodeReview } = await import('@/lib/eval/grok-critic')
    vi.mocked(runGrokCodeReview).mockResolvedValue({
      securityIssues: [],
      correctnessIssues: [],
      verdict: 'APPROVE',
      summary: 'Clean code',
      providerId: 'xai',
      reviewedAt: '2024-01-01T00:00:00.000Z',
    })

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      body: JSON.stringify({
        type: 'code-review',
        filePath: 'src/lib/auth.ts',
        fileContent: 'export function authenticate() {}',
      }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    const body = await res.json() as { verdict: string; summary: string }

    expect(res.status).toBe(200)
    expect(body.verdict).toBe('APPROVE')
    expect(body.summary).toBe('Clean code')
  })

  it('returns 400 when required fields missing', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ type: 'delegation' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)

    expect(res.status).toBe(400)
  })
})
