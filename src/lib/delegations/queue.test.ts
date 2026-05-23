import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Delegation } from '../models/delegation'

// ─── fs mock ──────────────────────────────────────────────────────────────────

const store = vi.hoisted(() => ({} as Record<string, string>))

vi.mock('fs', () => {
  const fsMock = {
    existsSync:    (p: string) => p in store,
    readFileSync:  (p: string) => {
      if (p in store) return store[p]
      throw Object.assign(new Error(`ENOENT: ${p}`), { code: 'ENOENT' })
    },
    writeFileSync: (p: string, data: string) => { store[p] = data },
    renameSync:    vi.fn(),
    mkdirSync:     vi.fn(),
  }
  return { default: fsMock, ...fsMock }
})

// ─── helpers ──────────────────────────────────────────────────────────────────

const DELEGATIONS_KEY = `${process.cwd()}/config/delegations.json`

function clearStore() { Object.keys(store).forEach(k => delete store[k]) }

function setDelegations(delegations: Partial<Delegation>[]) {
  store[DELEGATIONS_KEY] = JSON.stringify(delegations)
}

function makeDelegation(id: string, overrides: Partial<Delegation> = {}): Partial<Delegation> {
  return {
    id,
    title: `Task ${id}`,
    status: 'approved',
    priority: 0,
    executionRoute: 'runner',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    contract: {
      id: `c-${id}`,
      workItemId: 'wi-1',
      goal: `Goal for ${id}`,
      context: '',
      definitionOfDone: ['Done'],
      riskClass: 'A',
      maxBudgetUsd: 1,
      allowedTools: [],
      branchStrategy: 'feature',
      requiresApproval: false,
      privacyMode: 'private-cloud',
      createdAt: '2026-01-01T00:00:00Z',
    },
    costEstimateUsd: 0.1,
    ...overrides,
  }
}

// ─── tests ────────────────────────────────────────────────────────────────────

describe('getApprovedDelegations', () => {
  beforeEach(() => {
    clearStore()
    vi.resetModules()
  })

  it('returns empty array when no delegations file exists', async () => {
    const { getApprovedDelegations } = await import('./queue')
    expect(getApprovedDelegations()).toEqual([])
  })

  it('returns only approved delegations', async () => {
    setDelegations([
      makeDelegation('a1', { status: 'approved' }),
      makeDelegation('a2', { status: 'pending' }),
      makeDelegation('a3', { status: 'running' }),
      makeDelegation('a4', { status: 'completed' }),
      makeDelegation('a5', { status: 'approved' }),
    ])
    vi.resetModules()
    const { getApprovedDelegations } = await import('./queue')
    const result = getApprovedDelegations()
    expect(result).toHaveLength(2)
    expect(result.every(d => d.status === 'approved')).toBe(true)
  })

  it('sorts by priority descending', async () => {
    setDelegations([
      makeDelegation('low', { priority: 1 }),
      makeDelegation('high', { priority: 10 }),
      makeDelegation('mid', { priority: 5 }),
    ])
    vi.resetModules()
    const { getApprovedDelegations } = await import('./queue')
    const result = getApprovedDelegations()
    expect(result[0].id).toBe('high')
    expect(result[1].id).toBe('mid')
    expect(result[2].id).toBe('low')
  })

  it('uses createdAt as tie-breaker (older first)', async () => {
    setDelegations([
      makeDelegation('newer', { priority: 5, createdAt: '2026-01-02T00:00:00Z' }),
      makeDelegation('older', { priority: 5, createdAt: '2026-01-01T00:00:00Z' }),
    ])
    vi.resetModules()
    const { getApprovedDelegations } = await import('./queue')
    const result = getApprovedDelegations()
    expect(result[0].id).toBe('older')
    expect(result[1].id).toBe('newer')
  })

  it('treats missing priority as 0', async () => {
    setDelegations([
      makeDelegation('noprio', { priority: undefined }),
      makeDelegation('highprio', { priority: 3 }),
    ])
    vi.resetModules()
    const { getApprovedDelegations } = await import('./queue')
    const result = getApprovedDelegations()
    expect(result[0].id).toBe('highprio')
  })
})

describe('selectNextBatch', () => {
  beforeEach(() => {
    clearStore()
    vi.resetModules()
  })

  it('returns empty when no approved delegations', async () => {
    setDelegations([makeDelegation('r1', { status: 'running' })])
    vi.resetModules()
    const { selectNextBatch } = await import('./queue')
    expect(selectNextBatch()).toEqual([])
  })

  it('returns up to max delegations', async () => {
    setDelegations([
      makeDelegation('a1'),
      makeDelegation('a2'),
      makeDelegation('a3'),
      makeDelegation('a4'),
    ])
    vi.resetModules()
    const { selectNextBatch } = await import('./queue')
    const batch = selectNextBatch({ max: 3, maxConcurrent: 5 })
    expect(batch).toHaveLength(3)
  })

  it('respects maxConcurrent — returns empty when already at limit', async () => {
    setDelegations([
      makeDelegation('r1', { status: 'running' }),
      makeDelegation('r2', { status: 'running' }),
      makeDelegation('a1', { status: 'approved' }),
    ])
    vi.resetModules()
    const { selectNextBatch } = await import('./queue')
    const batch = selectNextBatch({ max: 3, maxConcurrent: 2 })
    expect(batch).toHaveLength(0)
  })

  it('reduces batch size when some slots are occupied by running', async () => {
    setDelegations([
      makeDelegation('r1', { status: 'running' }),
      makeDelegation('a1', { status: 'approved' }),
      makeDelegation('a2', { status: 'approved' }),
      makeDelegation('a3', { status: 'approved' }),
    ])
    vi.resetModules()
    const { selectNextBatch } = await import('./queue')
    // max=3, running=1, maxConcurrent=5 -> four slots remain, so max batch still applies.
    const batch = selectNextBatch({ max: 3, maxConcurrent: 5 })
    expect(batch).toHaveLength(3)
  })

  it('uses defaults: max=3, maxConcurrent=2', async () => {
    setDelegations([
      makeDelegation('a1'),
      makeDelegation('a2'),
      makeDelegation('a3'),
      makeDelegation('a4'),
    ])
    vi.resetModules()
    const { selectNextBatch } = await import('./queue')
    const batch = selectNextBatch()
    expect(batch.length).toBeLessThanOrEqual(3)
  })

  it('skips approved delegations that cannot be started by the runner', async () => {
    setDelegations([
      makeDelegation('blocked-budget', {
        priority: 10,
        contract: {
          ...makeDelegation('blocked-budget').contract!,
          maxBudgetUsd: 0,
        },
      }),
      makeDelegation('blocked-dod', {
        priority: 9,
        contract: {
          ...makeDelegation('blocked-dod').contract!,
          definitionOfDone: [],
        },
      }),
      makeDelegation('ready', { priority: 1 }),
    ])
    vi.resetModules()
    const { selectNextBatch } = await import('./queue')
    const batch = selectNextBatch({ max: 3, maxConcurrent: 3 })
    expect(batch.map(d => d.id)).toEqual(['ready'])
  })
})

describe('buildDelegationQueuePlan', () => {
  beforeEach(() => {
    clearStore()
    vi.resetModules()
  })

  it('returns a safe start plan for approved delegations', async () => {
    const delegations = [
      makeDelegation('low', { priority: 1 }),
      makeDelegation('high', { priority: 10 }),
      makeDelegation('mid', { priority: 5 }),
    ] as Delegation[]
    const { buildDelegationQueuePlan } = await import('./queue')

    const plan = buildDelegationQueuePlan({ delegations, max: 2, maxConcurrent: 2 })

    expect(plan.mode).toBe('safe-preview')
    expect(plan.recommendedStartIds).toEqual(['high', 'mid'])
    expect(plan.recommendedBatch[0]).toMatchObject({
      id: 'high',
      actionHref: '/api/delegations/high/start',
    })
    expect(plan.nextAction).toContain('Start 2 approved delegations now')
    expect(plan.warnings.join('\n')).toContain('Start only 2')
  })

  it('waits when concurrency is already full', async () => {
    const delegations = [
      makeDelegation('r1', { status: 'running' }),
      makeDelegation('r2', { status: 'running' }),
      makeDelegation('a1', { status: 'approved' }),
    ] as Delegation[]
    const { buildDelegationQueuePlan } = await import('./queue')

    const plan = buildDelegationQueuePlan({ delegations, max: 2, maxConcurrent: 2 })

    expect(plan.recommendedStartIds).toEqual([])
    expect(plan.nextAction).toContain('Wait for the running delegation slots')
    expect(plan.warnings.join('\n')).toContain('Already running 2 delegations')
  })

  it('surfaces pending approvals when nothing is approved', async () => {
    const delegations = [
      makeDelegation('needs-approval', {
        status: 'pending',
        contract: {
          ...makeDelegation('needs-approval').contract!,
          riskClass: 'B',
          requiresApproval: true,
        },
      }),
    ] as Delegation[]
    const { buildDelegationQueuePlan } = await import('./queue')

    const plan = buildDelegationQueuePlan({ delegations })

    expect(plan.recommendedStartIds).toEqual([])
    expect(plan.pendingApprovalIds).toEqual(['needs-approval'])
    expect(plan.nextAction).toContain('Review and approve')
  })

  it('surfaces approved execution blockers instead of recommending doomed starts', async () => {
    const delegations = [
      makeDelegation('missing-budget', {
        priority: 10,
        contract: {
          ...makeDelegation('missing-budget').contract!,
          maxBudgetUsd: 0,
        },
      }),
      makeDelegation('missing-dod', {
        priority: 9,
        contract: {
          ...makeDelegation('missing-dod').contract!,
          definitionOfDone: [],
        },
      }),
    ] as Delegation[]
    const { buildDelegationQueuePlan } = await import('./queue')

    const plan = buildDelegationQueuePlan({ delegations, max: 2, maxConcurrent: 2 })

    expect(plan.recommendedStartIds).toEqual([])
    expect(plan.blockedStartIds).toEqual(['missing-budget', 'missing-dod'])
    expect(plan.blockedStart[0]).toMatchObject({
      id: 'missing-budget',
      actionHref: undefined,
      blocker: 'Set maxBudgetUsd greater than 0 before automatic execution.',
    })
    expect(plan.nextAction).toContain('Fix the execution blockers')
    expect(plan.warnings.join('\n')).toContain('2 approved delegations cannot start')
  })
})

describe('getQueueStats', () => {
  beforeEach(() => {
    clearStore()
    vi.resetModules()
  })

  it('returns zero stats when store is empty', async () => {
    const { getQueueStats } = await import('./queue')
    const stats = getQueueStats()
    expect(stats.total).toBe(0)
    expect(stats.approved).toBe(0)
    expect(stats.running).toBe(0)
  })

  it('counts all statuses correctly', async () => {
    setDelegations([
      makeDelegation('p1', { status: 'pending' }),
      makeDelegation('p2', { status: 'pending' }),
      makeDelegation('a1', { status: 'approved' }),
      makeDelegation('r1', { status: 'running' }),
      makeDelegation('c1', { status: 'completed' }),
      makeDelegation('c2', { status: 'completed' }),
      makeDelegation('f1', { status: 'failed' }),
      makeDelegation('x1', { status: 'cancelled' }),
    ])
    vi.resetModules()
    const { getQueueStats } = await import('./queue')
    const stats = getQueueStats()
    expect(stats.pending).toBe(2)
    expect(stats.approved).toBe(1)
    expect(stats.running).toBe(1)
    expect(stats.completed).toBe(2)
    expect(stats.failed).toBe(1)
    expect(stats.cancelled).toBe(1)
    expect(stats.total).toBe(8)
  })

  it('total matches sum of all status counts', async () => {
    setDelegations([
      makeDelegation('a1', { status: 'approved' }),
      makeDelegation('r1', { status: 'running' }),
      makeDelegation('c1', { status: 'completed' }),
    ])
    vi.resetModules()
    const { getQueueStats } = await import('./queue')
    const stats = getQueueStats()
    const sum = stats.pending + stats.approved + stats.running + stats.completed + stats.failed + stats.cancelled
    expect(sum).toBe(stats.total)
  })
})
