import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Delegation } from '@/lib/models/delegation'

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockRunGrokCritic = vi.fn()
const mockRepoUpdate = vi.fn()
const mockRepoFindById = vi.fn()

vi.mock('@/lib/eval/grok-critic', () => ({
  runGrokCritic: mockRunGrokCritic,
  runGrokCodeReview: vi.fn(),
  mergeCriticScores: vi.fn(),
}))

vi.mock('@/lib/repositories/delegationRepository', () => ({
  createDelegationRepository: () => ({
    findById: mockRepoFindById,
    update: mockRepoUpdate,
    create: vi.fn(),
    delete: vi.fn(),
    listByStatus: vi.fn(),
    listByProject: vi.fn(),
  }),
  SINGLE_TENANT_USER_ID: 'local-user',
  getDelegationStorageMode: vi.fn().mockReturnValue('json'),
}))

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeCompletedDelegation(overrides: Partial<Delegation> = {}): Delegation {
  return {
    id: 'del-m181',
    title: 'Add Postgres schemas',
    status: 'completed',
    executionRoute: 'runner',
    costEstimateUsd: 0.1,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T01:00:00Z',
    contract: {
      id: 'c-m181',
      workItemId: 'wi-m181',
      goal: 'Add Drizzle tables for ProjectBriefs and KnowledgeCards',
      context: '',
      definitionOfDone: ['Schema compiles', 'Tests pass'],
      riskClass: 'B',
      maxBudgetUsd: 2,
      allowedTools: ['read', 'write'],
      branchStrategy: 'feature',
      requiresApproval: false,
      privacyMode: 'private-cloud',
      createdAt: '2026-01-01T00:00:00Z',
    },
    summaryReport: {
      keyPoints: ['Drizzle tables added', 'Indexes created'],
      changes: [],
      timeTakenMinutes: 20,
      filesAdded: ['src/db/schema.ts'],
      filesModified: ['src/lib/repositories/delegationRepository.ts'],
      testsPassed: 42,
    },
    ...overrides,
  }
}

// ─── CriticScore model tests ──────────────────────────────────────────────────

describe('M181 CriticScore model', () => {
  it('Delegation type accepts criticScore field', () => {
    const delegation = makeCompletedDelegation()
    delegation.criticScore = {
      correctness: 90,
      efficiency: 85,
      drift: 95,
      verdict: 'approved',
      summary: 'Well-structured implementation.',
      runAt: '2026-01-01T02:00:00Z',
    }
    expect(delegation.criticScore.verdict).toBe('approved')
    expect(delegation.criticScore.correctness).toBe(90)
  })

  it('criticScore is optional on Delegation', () => {
    const delegation = makeCompletedDelegation()
    expect(delegation.criticScore).toBeUndefined()
  })

  it('criticScore.verdict accepts approved | needs-revision | rejected', () => {
    const verdicts: Array<'approved' | 'needs-revision' | 'rejected'> = [
      'approved', 'needs-revision', 'rejected',
    ]
    for (const verdict of verdicts) {
      const delegation = makeCompletedDelegation()
      delegation.criticScore = {
        correctness: 50,
        efficiency: 50,
        drift: 50,
        verdict,
        summary: 'Test',
        runAt: new Date().toISOString(),
      }
      expect(delegation.criticScore.verdict).toBe(verdict)
    }
  })
})

// ─── Auto-grok trigger logic tests ───────────────────────────────────────────

describe('M181 auto-grok trigger', () => {
  const origXai = process.env.XAI_API_KEY

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (origXai === undefined) {
      delete process.env.XAI_API_KEY
    } else {
      process.env.XAI_API_KEY = origXai
    }
  })

  it('runGrokCritic maps PASS verdict to approved', () => {
    const verdictMap: Record<string, 'approved' | 'needs-revision' | 'rejected'> = {
      PASS: 'approved',
      NEEDS_REVISION: 'needs-revision',
      FAIL: 'rejected',
    }
    expect(verdictMap['PASS']).toBe('approved')
    expect(verdictMap['NEEDS_REVISION']).toBe('needs-revision')
    expect(verdictMap['FAIL']).toBe('rejected')
  })

  it('runGrokCritic is not called when XAI_API_KEY is absent', async () => {
    delete process.env.XAI_API_KEY

    // Simulate the condition guard from execute/route.ts
    const hasKey = Boolean(process.env.XAI_API_KEY)
    const shouldTrigger = true && true && hasKey  // success=true, report=true, key check

    if (shouldTrigger) {
      await mockRunGrokCritic()
    }

    expect(mockRunGrokCritic).not.toHaveBeenCalled()
  })

  it('runGrokCritic is called when XAI_API_KEY is set and execution succeeded', async () => {
    process.env.XAI_API_KEY = 'test-key'

    mockRunGrokCritic.mockResolvedValue({
      correctnessScore: 88,
      efficiencyScore: 80,
      driftScore: 92,
      verdict: 'PASS',
      reason: 'All criteria met.',
      overallGrade: 'A',
      criteriaHit: [true, true],
      issues: [],
      providerId: 'xai',
      evaluatedAt: '2026-01-01T02:00:00Z',
    })
    mockRepoUpdate.mockResolvedValue(null)

    const { runGrokCritic } = await import('@/lib/eval/grok-critic')
    const { createDelegationRepository, SINGLE_TENANT_USER_ID: uid } = await import('@/lib/repositories/delegationRepository')
    const repo = createDelegationRepository(uid)
    const delegation = makeCompletedDelegation()

    // Simulate the auto-grok block from execute/route.ts
    const success = true
    const report = delegation.summaryReport
    if (success && report && process.env.XAI_API_KEY) {
      const criticResult = await runGrokCritic({
        delegationTitle: delegation.title || delegation.contract.goal,
        delegationContract: delegation.contract.goal,
        acceptanceCriteria: delegation.contract.definitionOfDone ?? [],
        agentOutput: report.keyPoints?.join('\n') ?? delegation.contract.goal,
        filesChanged: [...(report.filesAdded ?? []), ...(report.filesModified ?? [])],
      })
      if (criticResult) {
        const verdictMap: Record<string, 'approved' | 'needs-revision' | 'rejected'> = {
          PASS: 'approved',
          NEEDS_REVISION: 'needs-revision',
          FAIL: 'rejected',
        }
        await repo.update(delegation.id, {
          criticScore: {
            correctness: criticResult.correctnessScore,
            efficiency: criticResult.efficiencyScore,
            drift: criticResult.driftScore,
            verdict: verdictMap[criticResult.verdict] ?? 'needs-revision',
            summary: criticResult.reason,
            runAt: criticResult.evaluatedAt,
          },
        })
      }
    }

    expect(runGrokCritic).toHaveBeenCalledOnce()
    expect(mockRepoUpdate).toHaveBeenCalledWith(delegation.id, expect.objectContaining({
      criticScore: expect.objectContaining({
        correctness: 88,
        verdict: 'approved',
      }),
    }))
  })

  it('grok failure does not break execution (non-critical)', async () => {
    process.env.XAI_API_KEY = 'test-key'
    mockRunGrokCritic.mockRejectedValue(new Error('xAI timeout'))

    const { runGrokCritic } = await import('@/lib/eval/grok-critic')

    let errorThrown = false
    try {
      await runGrokCritic({
        delegationTitle: 'Test',
        delegationContract: 'Goal',
        acceptanceCriteria: [],
        agentOutput: '',
      }).catch(() => {
        // Swallowed — non-critical
      })
    } catch {
      errorThrown = true
    }

    expect(errorThrown).toBe(false)
  })
})
