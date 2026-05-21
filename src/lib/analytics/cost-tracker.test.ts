/**
 * Tests for Provider Cost Tracker — M159
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Delegation } from '@/lib/models/delegation'

// ── fs mock ────────────────────────────────────────────────────────────────────

const { mockReadFileSync } = vi.hoisted(() => ({
  mockReadFileSync: vi.fn(() => '[]'),
}))

vi.mock('fs', () => ({
  default: {
    readFileSync: mockReadFileSync,
  },
}))

import { buildCostReport, formatCostCompact, formatTokens } from './cost-tracker'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeDelegation(overrides: Partial<Delegation>): Delegation {
  return {
    id: 'del-1',
    title: 'Test',
    status: 'completed',
    executionRoute: 'ollama-agent',
    actualCostUsd: 0,
    createdAt: '2026-05-20T10:00:00.000Z',
    updatedAt: '2026-05-20T10:00:00.000Z',
    ...overrides,
  } as Delegation
}

function setDelegations(delegations: Delegation[]) {
  mockReadFileSync.mockReturnValue(JSON.stringify(delegations))
}

// ── Tests: buildCostReport ────────────────────────────────────────────────────

describe('buildCostReport', () => {
  beforeEach(() => {
    mockReadFileSync.mockReturnValue('[]')
  })

  it('returns empty report when no delegations', () => {
    const report = buildCostReport()
    expect(report.entries).toHaveLength(0)
    expect(report.totals.delegationCount).toBe(0)
    expect(report.totals.totalCostUsd).toBe(0)
    expect(report.totals.totalTokens).toBe(0)
  })

  it('ignores non-completed delegations', () => {
    setDelegations([
      makeDelegation({ status: 'pending' }),
      makeDelegation({ status: 'running' }),
      makeDelegation({ status: 'failed' }),
    ])
    const report = buildCostReport()
    expect(report.entries).toHaveLength(0)
    expect(report.totals.delegationCount).toBe(0)
  })

  it('aggregates completed Ollama delegation', () => {
    setDelegations([
      makeDelegation({
        executionRoute: 'ollama-agent',
        actualCostUsd: 0,
        summaryReport: {
          costSavings: {
            cloudEquivalentUsd: 1.04,
            savedUsd: 0.74,
            localModel: 'llama3.2:3b',
            inputTokens: 1980,
            outputTokens: 792,
          },
        } as unknown as Delegation['summaryReport'],
      }),
    ])
    const report = buildCostReport()
    expect(report.entries).toHaveLength(1)
    const e = report.entries[0]
    expect(e.providerId).toBe('ollama-agent')
    expect(e.delegationCount).toBe(1)
    expect(e.totalCostUsd).toBe(0)
    expect(e.cloudEquivalentUsd).toBe(1.04)
    expect(e.totalSavedUsd).toBe(0.74)
    expect(e.totalTokens).toBe(1980 + 792)
    expect(e.lastModel).toBe('llama3.2:3b')
  })

  it('aggregates completed cloud delegation', () => {
    setDelegations([
      makeDelegation({
        executionRoute: 'direct-chat',
        actualCostUsd: 0.0042,
        summaryReport: {
          costSavings: {
            cloudEquivalentUsd: 0.0042,
            savedUsd: 0,
            inputTokens: 500,
            outputTokens: 300,
          },
        } as unknown as Delegation['summaryReport'],
      }),
    ])
    const report = buildCostReport()
    const e = report.entries[0]
    expect(e.totalCostUsd).toBeCloseTo(0.0042, 6)
    expect(e.cloudEquivalentUsd).toBeCloseTo(0.0042, 6)
    expect(e.totalSavedUsd).toBe(0)
    expect(e.totalTokens).toBe(800)
  })

  it('groups multiple delegations by executionRoute', () => {
    setDelegations([
      makeDelegation({ executionRoute: 'ollama-agent', actualCostUsd: 0 }),
      makeDelegation({ id: 'del-2', executionRoute: 'ollama-agent', actualCostUsd: 0 }),
      makeDelegation({ id: 'del-3', executionRoute: 'runner', actualCostUsd: 0.01 }),
    ])
    const report = buildCostReport()
    expect(report.entries).toHaveLength(2)
    const ollama = report.entries.find(e => e.providerId === 'ollama-agent')!
    expect(ollama.delegationCount).toBe(2)
    const runner = report.entries.find(e => e.providerId === 'runner')!
    expect(runner.delegationCount).toBe(1)
  })

  it('handles legacy claudeEquivalentUsd field', () => {
    setDelegations([
      makeDelegation({
        summaryReport: {
          costSavings: {
            claudeEquivalentUsd: 0.55,
            savedUsd: 0.30,
          },
        } as unknown as Delegation['summaryReport'],
      }),
    ])
    const e = buildCostReport().entries[0]
    expect(e.cloudEquivalentUsd).toBeCloseTo(0.55, 6)
  })

  it('handles legacy tokensUsed field', () => {
    setDelegations([
      makeDelegation({
        summaryReport: {
          costSavings: {
            tokensUsed: { promptTokens: 400, completionTokens: 200 },
          },
        } as unknown as Delegation['summaryReport'],
      }),
    ])
    const e = buildCostReport().entries[0]
    expect(e.totalTokens).toBe(600)
  })

  it('falls back to actualCostUsd for cloudEquivalentUsd when no costSavings', () => {
    setDelegations([
      makeDelegation({ actualCostUsd: 0.02, summaryReport: undefined }),
    ])
    const e = buildCostReport().entries[0]
    expect(e.cloudEquivalentUsd).toBeCloseTo(0.02, 6)
  })

  it('uses unknown route for delegations without executionRoute', () => {
    setDelegations([
      makeDelegation({ executionRoute: undefined }),
    ])
    const e = buildCostReport().entries[0]
    expect(e.providerId).toBe('unknown')
  })

  it('computes totals across all entries', () => {
    setDelegations([
      makeDelegation({
        executionRoute: 'ollama-agent',
        actualCostUsd: 0,
        summaryReport: {
          costSavings: { cloudEquivalentUsd: 1.0, savedUsd: 0.5, inputTokens: 1000, outputTokens: 500 },
        } as unknown as Delegation['summaryReport'],
      }),
      makeDelegation({
        id: 'del-2',
        executionRoute: 'runner',
        actualCostUsd: 0.01,
        summaryReport: {
          costSavings: { cloudEquivalentUsd: 0.01, savedUsd: 0, inputTokens: 200, outputTokens: 100 },
        } as unknown as Delegation['summaryReport'],
      }),
    ])
    const { totals } = buildCostReport()
    expect(totals.delegationCount).toBe(2)
    expect(totals.totalCostUsd).toBeCloseTo(0.01, 6)
    expect(totals.cloudEquivalentUsd).toBeCloseTo(1.01, 6)
    expect(totals.totalSavedUsd).toBeCloseTo(0.5, 6)
    expect(totals.totalTokens).toBe(1800)
  })

  it('computes costTrend7d when previous period has cost', () => {
    const now = new Date('2026-05-21T12:00:00.000Z')
    const last7d   = new Date('2026-05-18T12:00:00.000Z').toISOString()
    const prev7d   = new Date('2026-05-11T12:00:00.000Z').toISOString()
    setDelegations([
      makeDelegation({ actualCostUsd: 0.02, updatedAt: last7d }),  // last 7d
      makeDelegation({ id: 'del-2', actualCostUsd: 0.01, updatedAt: prev7d }), // prev 7d
    ])
    const e = buildCostReport(now).entries[0]
    // trend = (0.02 - 0.01) / 0.01 * 100 = 100%
    expect(e.costTrend7d).toBe(100)
  })

  it('returns null costTrend7d when no previous period cost', () => {
    const now = new Date('2026-05-21T12:00:00.000Z')
    const last7d = new Date('2026-05-18T12:00:00.000Z').toISOString()
    setDelegations([
      makeDelegation({ actualCostUsd: 0.02, updatedAt: last7d }),
    ])
    const e = buildCostReport(now).entries[0]
    expect(e.costTrend7d).toBeNull()
  })

  it('returns generatedAt as ISO string', () => {
    const now = new Date('2026-05-21T10:00:00.000Z')
    const report = buildCostReport(now)
    expect(report.generatedAt).toBe('2026-05-21T10:00:00.000Z')
  })
})

// ── Tests: formatCostCompact ──────────────────────────────────────────────────

describe('formatCostCompact', () => {
  it('returns $0 for zero', () => {
    expect(formatCostCompact(0)).toBe('$0')
  })

  it('returns < $0.01 for small values', () => {
    expect(formatCostCompact(0.0023)).toBe('< $0.01')
    expect(formatCostCompact(0.009)).toBe('< $0.01')
  })

  it('returns 3 decimal places for values < 1', () => {
    expect(formatCostCompact(0.015)).toBe('$0.015')
    expect(formatCostCompact(0.123)).toBe('$0.123')
  })

  it('returns 2 decimal places for values >= 1', () => {
    expect(formatCostCompact(1.5)).toBe('$1.50')
    expect(formatCostCompact(12.34)).toBe('$12.34')
  })
})

// ── Tests: formatTokens ───────────────────────────────────────────────────────

describe('formatTokens', () => {
  it('formats plain numbers under 1K', () => {
    expect(formatTokens(0)).toBe('0')
    expect(formatTokens(500)).toBe('500')
    expect(formatTokens(999)).toBe('999')
  })

  it('formats K with 1 decimal', () => {
    expect(formatTokens(1000)).toBe('1.0K')
    expect(formatTokens(1200)).toBe('1.2K')
    expect(formatTokens(999999)).toBe('1000.0K')
  })

  it('formats M with 1 decimal', () => {
    expect(formatTokens(1_000_000)).toBe('1.0M')
    expect(formatTokens(3_400_000)).toBe('3.4M')
  })
})
