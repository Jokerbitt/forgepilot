/**
 * @vitest-environment node
 *
 * Tests for POST /api/delegations/[id]/critic-review
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Delegation } from '@/lib/models/delegation'
import type { GrokCriticResult, CodeReviewResult } from '@/lib/eval/grok-critic'

// ── Repository mock ────────────────────────────────────────────────────────────

const repoFindById = vi.fn<[string], Promise<Delegation | null>>()
const repoUpdate   = vi.fn<[string, Partial<Delegation>], Promise<Delegation | null>>()

vi.mock('@/lib/repositories/delegationRepository', () => ({
  SINGLE_TENANT_USER_ID: 'user-1',
  createDelegationRepository: vi.fn(() => ({ findById: repoFindById, update: repoUpdate })),
}))

// ── Critic mocks ───────────────────────────────────────────────────────────────

const runGrokCritic     = vi.fn<[unknown], Promise<GrokCriticResult | null>>()
const runGrokCodeReview = vi.fn<[unknown], Promise<CodeReviewResult | null>>()
const getCriticProviderPlan = vi.fn(() => 'mock-plan')
const mapGrokResultToCriticScore = vi.fn(() => ({ correctness: 85, efficiency: 80, drift: 90, verdict: 'approved', summary: 'ok', runAt: '' }))

vi.mock('@/lib/eval/grok-critic', () => ({ runGrokCritic, runGrokCodeReview, getCriticProviderPlan }))
vi.mock('@/lib/eval/auto-grok-critic', () => ({
  mapGrokResultToCriticScore,
  buildCriticAgentOutput: (_report: unknown, fallback: string) => fallback,
}))

// ── Fixture ────────────────────────────────────────────────────────────────────

function makeDelegation(overrides: Partial<Delegation> = {}): Delegation {
  return {
    id: 'del-001',
    title: 'Test',
    status: 'completed',
    executionRoute: 'local-agent',
    costEstimateUsd: 0.10,
    createdAt: '2026-05-01T10:00:00.000Z',
    updatedAt: '2026-05-01T10:00:00.000Z',
    contract: {
      id: 'con-001',
      workItemId: 'FP-001',
      goal: 'Test goal',
      context: 'ctx',
      riskClass: 'A',
      maxBudgetUsd: 1.0,
      allowedTools: ['read'],
      branchStrategy: 'feature',
      requiresApproval: false,
      privacyMode: 'local',
      definitionOfDone: ['Task completed'],
      createdAt: '2026-05-01T10:00:00.000Z',
    },
    ...overrides,
  }
}

function makeRequest(id: string, body: Record<string, unknown>) {
  return new Request(`http://localhost/api/delegations/${id}/critic-review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/delegations/[id]/critic-review', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 404 when delegation not found', async () => {
    repoFindById.mockResolvedValueOnce(null)
    const { POST } = await import('./route')
    const res = await POST(makeRequest('missing', { output: 'result' }), makeParams('missing'))
    expect(res.status).toBe(404)
  })

  it('runs delegation review and persists critic score', async () => {
    const mockResult: GrokCriticResult = {
      correctnessScore: 90,
      efficiencyScore: 80,
      driftScore: 85,
      overallGrade: 'A',
      criteriaHit: [true],
      issues: [],
      verdict: 'PASS',
      reason: 'Well done',
      providerId: 'xai',
      evaluatedAt: '2026-05-01T10:00:00.000Z',
    }
    repoFindById.mockResolvedValueOnce(makeDelegation())
    runGrokCritic.mockResolvedValueOnce(mockResult)
    repoUpdate.mockResolvedValueOnce(makeDelegation())
    const { POST } = await import('./route')
    const res = await POST(
      makeRequest('del-001', { output: 'Agent completed the task' }),
      makeParams('del-001'),
    )
    expect(res.status).toBe(200)
    const body = await res.json() as GrokCriticResult
    expect(body.correctnessScore).toBe(90)
    expect(repoUpdate).toHaveBeenCalledOnce()
  })

  it('returns 502 when critic returns null', async () => {
    repoFindById.mockResolvedValueOnce(makeDelegation())
    runGrokCritic.mockResolvedValueOnce(null)
    const { POST } = await import('./route')
    const res = await POST(
      makeRequest('del-001', { output: 'output' }),
      makeParams('del-001'),
    )
    expect(res.status).toBe(502)
    expect(repoUpdate).not.toHaveBeenCalled()
  })

  it('runs code review when type=code and filePath provided', async () => {
    const mockCodeResult: CodeReviewResult = {
      securityIssues: [],
      correctnessIssues: [],
      verdict: 'APPROVE',
      summary: 'Code looks good',
      providerId: 'xai',
      reviewedAt: '2026-05-01T10:00:00.000Z',
    }
    repoFindById.mockResolvedValueOnce(makeDelegation())
    runGrokCodeReview.mockResolvedValueOnce(mockCodeResult)
    const { POST } = await import('./route')
    const res = await POST(
      makeRequest('del-001', {
        output: 'const x = 1',
        type: 'code',
        filePath: 'src/foo.ts',
      }),
      makeParams('del-001'),
    )
    expect(res.status).toBe(200)
    expect(runGrokCodeReview).toHaveBeenCalledOnce()
    expect(runGrokCritic).not.toHaveBeenCalled()
  })

  it('returns 400 when type=code but filePath is missing', async () => {
    repoFindById.mockResolvedValueOnce(makeDelegation())
    const { POST } = await import('./route')
    const res = await POST(
      makeRequest('del-001', { output: 'code content', type: 'code' }),
      makeParams('del-001'),
    )
    expect(res.status).toBe(400)
    expect(runGrokCodeReview).not.toHaveBeenCalled()
  })

  it('returns 502 when code review returns null', async () => {
    repoFindById.mockResolvedValueOnce(makeDelegation())
    runGrokCodeReview.mockResolvedValueOnce(null)
    const { POST } = await import('./route')
    const res = await POST(
      makeRequest('del-001', { output: 'code', type: 'code', filePath: 'src/bar.ts' }),
      makeParams('del-001'),
    )
    expect(res.status).toBe(502)
  })
})
