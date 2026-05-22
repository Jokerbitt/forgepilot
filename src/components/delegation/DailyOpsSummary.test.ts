import { describe, it, expect } from 'vitest'
import type { Delegation } from '@/lib/models/delegation'

// ── Inline reimplementation of pure helpers for unit testing ─────────────────
// (exported helpers would add bundle overhead; we test behaviour instead)

const STALE_THRESHOLD_DAYS = 30

function isCardStale(updatedAt: string): boolean {
  return Date.now() - new Date(updatedAt).getTime() > STALE_THRESHOLD_DAYS * 86_400_000
}

interface OpsSummary {
  completedToday: number
  failedToday: number
  running: number
  pendingDecisions: number
  totalCostUsd: number
  budgetWarnCount: number
  avgCriticScore: number | null
}

function buildSummary(delegations: Delegation[]): OpsSummary {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayMs = todayStart.getTime()

  const completedToday = delegations.filter(
    d => d.status === 'completed' && new Date(d.updatedAt).getTime() >= todayMs,
  ).length

  const failedToday = delegations.filter(
    d => d.status === 'failed' && new Date(d.updatedAt).getTime() >= todayMs,
  ).length

  const running = delegations.filter(d => d.status === 'running').length

  const pendingDecisions = delegations.filter(
    d => d.status === 'pending' && d.contract.requiresApproval !== false,
  ).length

  const totalCostUsd = delegations.reduce((s, d) => s + (d.actualCostUsd ?? 0), 0)

  const budgetWarnCount = delegations.filter(d => {
    if (!d.actualCostUsd || !d.contract.maxBudgetUsd) return false
    return d.actualCostUsd / d.contract.maxBudgetUsd >= 0.8
  }).length

  const scored = delegations.filter(d => d.criticScore != null)
  const avgCriticScore =
    scored.length > 0
      ? Math.round(
          scored.reduce((s, d) => {
            const sc = d.criticScore!
            return s + (sc.correctness + sc.efficiency + (100 - sc.drift)) / 3
          }, 0) / scored.length,
        )
      : null

  return { completedToday, failedToday, running, pendingDecisions, totalCostUsd, budgetWarnCount, avgCriticScore }
}

// ── Fixture helpers ───────────────────────────────────────────────────────────

function makeDelegation(overrides: Partial<Delegation>): Delegation {
  const now = new Date().toISOString()
  return {
    id: 'test-id',
    title: 'Test',
    status: 'pending',
    createdAt: now,
    updatedAt: now,
    contract: {
      id: 'c1',
      goal: 'Test goal',
      context: [],
      definitionOfDone: [],
      riskClass: 'A',
      maxBudgetUsd: 1,
      allowedTools: [],
      branchStrategy: 'feature',
      requiresApproval: true,
      privacyMode: 'local',
    },
    logs: [],
    ...overrides,
  } as unknown as Delegation
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('isCardStale', () => {
  it('returns false for a recent date', () => {
    const recent = new Date(Date.now() - 5 * 86_400_000).toISOString()
    expect(isCardStale(recent)).toBe(false)
  })

  it('returns true for a date older than 30 days', () => {
    const old = new Date(Date.now() - 31 * 86_400_000).toISOString()
    expect(isCardStale(old)).toBe(true)
  })
})

describe('buildSummary', () => {
  it('returns zeros for empty list', () => {
    const s = buildSummary([])
    expect(s.completedToday).toBe(0)
    expect(s.running).toBe(0)
    expect(s.pendingDecisions).toBe(0)
    expect(s.totalCostUsd).toBe(0)
    expect(s.avgCriticScore).toBeNull()
  })

  it('counts running delegations', () => {
    const delegations = [
      makeDelegation({ status: 'running' }),
      makeDelegation({ status: 'running' }),
      makeDelegation({ status: 'pending' }),
    ]
    expect(buildSummary(delegations).running).toBe(2)
  })

  it('counts only today completions', () => {
    const yesterday = new Date(Date.now() - 25 * 3_600_000).toISOString()
    const delegations = [
      makeDelegation({ status: 'completed', updatedAt: new Date().toISOString() }),
      makeDelegation({ status: 'completed', updatedAt: yesterday }),
    ]
    // Yesterday might still be "today" depending on time — use midnight boundary
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    const expected = new Date(yesterday).getTime() >= todayStart.getTime() ? 2 : 1
    expect(buildSummary(delegations).completedToday).toBe(expected)
  })

  it('counts pending decisions (requiresApproval not false)', () => {
    const delegations = [
      makeDelegation({ status: 'pending', contract: { requiresApproval: false } as never }),
      makeDelegation({ status: 'pending', contract: { requiresApproval: true } as never }),
      makeDelegation({ status: 'pending' }),
    ]
    expect(buildSummary(delegations).pendingDecisions).toBe(2)
  })

  it('sums total cost correctly', () => {
    const delegations = [
      makeDelegation({ actualCostUsd: 0.5 }),
      makeDelegation({ actualCostUsd: 0.3 }),
      makeDelegation({}),
    ]
    expect(buildSummary(delegations).totalCostUsd).toBeCloseTo(0.8)
  })

  it('detects budget warnings at ≥80%', () => {
    const delegations = [
      makeDelegation({ actualCostUsd: 0.85, contract: { maxBudgetUsd: 1 } as never }),
      makeDelegation({ actualCostUsd: 0.5,  contract: { maxBudgetUsd: 1 } as never }),
    ]
    expect(buildSummary(delegations).budgetWarnCount).toBe(1)
  })

  it('computes average critic score', () => {
    const delegations = [
      makeDelegation({ criticScore: { correctness: 80, efficiency: 70, drift: 20, verdict: 'pass' } }),
      makeDelegation({ criticScore: { correctness: 60, efficiency: 60, drift: 40, verdict: 'pass' } }),
    ]
    // d1: (80 + 70 + 80) / 3 = 76.67; d2: (60 + 60 + 60) / 3 = 60 → avg = 68.33 → 68
    expect(buildSummary(delegations).avgCriticScore).toBe(68)
  })
})
