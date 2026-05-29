/**
 * @vitest-environment node
 *
 * Tests for POST /api/delegations/[id]/auto-merge
 * Focuses on the evaluateSafetyGates logic.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Delegation } from '@/lib/models/delegation'
import { evaluateSafetyGates } from './route'

// ── Fixture ────────────────────────────────────────────────────────────────────

function makeCompletedDelegation(overrides: Partial<Delegation> = {}): Delegation {
  return {
    id: 'del-auto-001',
    title: 'Auto-Merge Test Delegation',
    status: 'completed',
    executionRoute: 'local-agent',
    costEstimateUsd: 0.10,
    createdAt: '2026-05-01T10:00:00.000Z',
    updatedAt: '2026-05-01T10:00:00.000Z',
    contract: {
      id: 'con-001',
      workItemId: 'FP-100',
      goal: 'Build auto-merge feature',
      context: 'M7 safety gates',
      riskClass: 'A',
      maxBudgetUsd: 5.0,
      allowedTools: ['read', 'write'],
      branchStrategy: 'feature',
      requiresApproval: false,
      privacyMode: 'local',
      definitionOfDone: ['Tests pass', 'Type-check clean'],
      createdAt: '2026-05-01T10:00:00.000Z',
    },
    summaryReport: {
      keyPoints: ['Auto-merge implemented'],
      changes: [],
      timeTakenMinutes: 30,
      prUrl: 'https://github.com/org/repo/pull/42',
      prState: 'open',
      testsPassed: 5,
      linesAdded: 100,
      linesRemoved: 20,
    },
    ...overrides,
  }
}

// ── evaluateSafetyGates unit tests ─────────────────────────────────────────────

describe('evaluateSafetyGates', () => {
  it('passes all gates when all conditions are met', () => {
    const delegation = makeCompletedDelegation()
    const { gates, blockedBy } = evaluateSafetyGates(delegation)

    expect(blockedBy).toBeUndefined()
    expect(gates.every(g => g.passed)).toBe(true)
  })

  it('blocks on Risk Class C', () => {
    const delegation = makeCompletedDelegation({
      contract: {
        ...makeCompletedDelegation().contract,
        riskClass: 'C',
      },
    })
    const { gates, blockedBy } = evaluateSafetyGates(delegation)

    expect(blockedBy).toBe('Kein Risk-Class-C')
    const riskGate = gates.find(g => g.name === 'Kein Risk-Class-C')
    expect(riskGate?.passed).toBe(false)
  })

  it('blocks when PR URL is missing', () => {
    const delegation = makeCompletedDelegation({
      summaryReport: {
        keyPoints: [],
        changes: [],
        timeTakenMinutes: 0,
        testsPassed: 3,
      },
    })
    const { gates, blockedBy } = evaluateSafetyGates(delegation)

    expect(blockedBy).toBe('PR vorhanden')
    const prGate = gates.find(g => g.name === 'PR vorhanden')
    expect(prGate?.passed).toBe(false)
  })

  it('blocks when delegation is not completed', () => {
    const delegation = makeCompletedDelegation({ status: 'running' })
    const { gates, blockedBy } = evaluateSafetyGates(delegation)

    expect(blockedBy).toBe('Status abgeschlossen')
    const statusGate = gates.find(g => g.name === 'Status abgeschlossen')
    expect(statusGate?.passed).toBe(false)
  })

  it('blocks when PR is already merged', () => {
    const delegation = makeCompletedDelegation({
      summaryReport: {
        ...makeCompletedDelegation().summaryReport!,
        prState: 'merged',
      },
    })
    const { gates, blockedBy } = evaluateSafetyGates(delegation)

    expect(blockedBy).toBe('PR noch offen')
  })

  it('blocks when too many lines changed (>= 500)', () => {
    const delegation = makeCompletedDelegation({
      summaryReport: {
        ...makeCompletedDelegation().summaryReport!,
        linesAdded: 400,
        linesRemoved: 150,
      },
    })
    const { gates, blockedBy } = evaluateSafetyGates(delegation)

    expect(blockedBy).toBe('Überschaubare Änderungen')
    const linesGate = gates.find(g => g.name === 'Überschaubare Änderungen')
    expect(linesGate?.passed).toBe(false)
    expect(linesGate?.detail).toContain('550')
  })

  it('skips the lines gate when no line info is available', () => {
    const { summaryReport, ...base } = makeCompletedDelegation()
    const delegation = makeCompletedDelegation({
      summaryReport: {
        ...summaryReport!,
        linesAdded: undefined,
        linesRemoved: undefined,
      },
    })
    const { gates, blockedBy } = evaluateSafetyGates(delegation)

    const linesGate = gates.find(g => g.name === 'Überschaubare Änderungen')
    expect(linesGate?.passed).toBe(true)
    expect(linesGate?.detail).toContain('übersprungen')
    // blockedBy should not be lines gate
    expect(blockedBy).not.toBe('Überschaubare Änderungen')
  })

  it('blocks when critic score is below 70', () => {
    const delegation = makeCompletedDelegation({
      criticScore: {
        correctness: 65,
        efficiency: 80,
        drift: 20,
        verdict: 'needs-revision',
        summary: 'Some issues found',
        runAt: '2026-05-01T12:00:00.000Z',
      },
    })
    const { gates, blockedBy } = evaluateSafetyGates(delegation)

    expect(blockedBy).toBe('Critic-Score ausreichend')
    const criticGate = gates.find(g => g.name === 'Critic-Score ausreichend')
    expect(criticGate?.passed).toBe(false)
  })

  it('passes critic gate when score is exactly 70', () => {
    const delegation = makeCompletedDelegation({
      criticScore: {
        correctness: 70,
        efficiency: 75,
        drift: 10,
        verdict: 'approved',
        summary: 'Acceptable',
        runAt: '2026-05-01T12:00:00.000Z',
      },
    })
    const { gates } = evaluateSafetyGates(delegation)

    const criticGate = gates.find(g => g.name === 'Critic-Score ausreichend')
    expect(criticGate?.passed).toBe(true)
  })

  it('skips critic gate when no critic score exists', () => {
    const delegation = makeCompletedDelegation({ criticScore: undefined })
    const { gates, blockedBy } = evaluateSafetyGates(delegation)

    const criticGate = gates.find(g => g.name === 'Critic-Score ausreichend')
    expect(criticGate?.passed).toBe(true)
    expect(criticGate?.detail).toContain('übersprungen')
  })

  it('passes tests gate when quality check verdict is passed (even without testsPassed)', () => {
    const delegation = makeCompletedDelegation({
      summaryReport: {
        ...makeCompletedDelegation().summaryReport!,
        testsPassed: 0,
      },
    }) as Delegation & { qualityCheck: { verdict: string } }
    ;(delegation as unknown as Record<string, unknown>).qualityCheck = { verdict: 'passed' }

    const { gates, blockedBy } = evaluateSafetyGates(delegation)
    const testsGate = gates.find(g => g.name === 'Tests bestanden')
    expect(testsGate?.passed).toBe(true)
  })

  it('returns exactly 7 gates', () => {
    const { gates } = evaluateSafetyGates(makeCompletedDelegation())
    expect(gates).toHaveLength(7)
  })
})

// ── POST handler integration tests ────────────────────────────────────────────

const repoFindById = vi.fn<[string], Promise<Delegation | null>>()
const repoUpdate   = vi.fn<[string, Partial<Delegation>], Promise<Delegation | null>>()

vi.mock('@/lib/repositories/delegationRepository', () => ({
  SINGLE_TENANT_USER_ID: 'user-1',
  createDelegationRepository: vi.fn(() => ({
    findById: repoFindById,
    update:   repoUpdate,
  })),
}))

const execFileSyncMock = vi.fn()
vi.mock('child_process', () => ({
  execFileSync: (...args: unknown[]) => execFileSyncMock(...args),
}))

describe('POST /api/delegations/[id]/auto-merge', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    repoUpdate.mockResolvedValue(makeCompletedDelegation())
  })

  it('returns 404 when delegation not found', async () => {
    repoFindById.mockResolvedValue(null)
    const { POST } = await import('./route')
    const req = new Request('http://localhost/api/delegations/missing/auto-merge', { method: 'POST' })
    const res = await POST(req, { params: Promise.resolve({ id: 'missing' }) })
    expect(res.status).toBe(404)
  })

  it('returns 422 with blockedBy when gates fail', async () => {
    const delegation = makeCompletedDelegation({ status: 'running' })
    repoFindById.mockResolvedValue(delegation)
    const { POST } = await import('./route')
    const req = new Request('http://localhost/api/delegations/del-auto-001/auto-merge', { method: 'POST' })
    const res = await POST(req, { params: Promise.resolve({ id: 'del-auto-001' }) })
    expect(res.status).toBe(422)
    const body = await res.json() as { merged: boolean; blockedBy: string }
    expect(body.merged).toBe(false)
    expect(body.blockedBy).toBeTruthy()
  })

  it('merges and returns merged=true when all gates pass', async () => {
    repoFindById.mockResolvedValue(makeCompletedDelegation())
    execFileSyncMock.mockReturnValue('')
    const { POST } = await import('./route')
    const req = new Request('http://localhost/api/delegations/del-auto-001/auto-merge', { method: 'POST' })
    const res = await POST(req, { params: Promise.resolve({ id: 'del-auto-001' }) })
    expect(res.status).toBe(200)
    const body = await res.json() as { merged: boolean }
    expect(body.merged).toBe(true)
    expect(execFileSyncMock).toHaveBeenCalledWith(
      'gh',
      ['pr', 'merge', 'https://github.com/org/repo/pull/42', '--squash', '--auto'],
      expect.objectContaining({ encoding: 'utf-8' }),
    )
    expect(repoUpdate).toHaveBeenCalledWith(
      'del-auto-001',
      expect.objectContaining({
        summaryReport: expect.objectContaining({ prState: 'merged' }),
      }),
    )
  })

  it('returns 500 when gh pr merge fails', async () => {
    repoFindById.mockResolvedValue(makeCompletedDelegation())
    execFileSyncMock.mockImplementation(() => { throw new Error('gh not found') })
    const { POST } = await import('./route')
    const req = new Request('http://localhost/api/delegations/del-auto-001/auto-merge', { method: 'POST' })
    const res = await POST(req, { params: Promise.resolve({ id: 'del-auto-001' }) })
    expect(res.status).toBe(500)
    const body = await res.json() as { merged: boolean; blockedBy: string }
    expect(body.merged).toBe(false)
    expect(body.blockedBy).toContain('gh pr merge fehlgeschlagen')
  })
})
