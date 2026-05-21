import { describe, it, expect } from 'vitest'
import { computeDueAt, getSlaStatus, formatSlaRemaining, SLA_HOURS_BY_RISK } from './sla'
import type { Delegation } from '@/lib/models/delegation'

// Minimal delegation stub for testing
function makeDelegation(overrides: Partial<Delegation> & { riskClass?: string }): Delegation {
  const { riskClass = 'medium', ...rest } = overrides
  return {
    id: 'del-test',
    title: 'Test Delegation',
    contract: {
      id: 'c1', workItemId: 'w1', goal: 'test', context: '',
      definitionOfDone: [], riskClass: riskClass as never,
      maxBudgetUsd: 10, allowedTools: [], branchStrategy: 'feature',
      requiresApproval: false, privacyMode: 'local',
      outputMode: 'text', createdAt: new Date().toISOString(),
    },
    status: 'pending',
    executionRoute: 'direct-chat',
    costEstimateUsd: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...rest,
  }
}

describe('SLA_HOURS_BY_RISK', () => {
  it('has entries for all three risk classes', () => {
    expect(SLA_HOURS_BY_RISK).toMatchObject({ A: 72, B: 24, C: 8 })
  })
})

describe('computeDueAt', () => {
  it('returns null for terminal statuses', () => {
    for (const status of ['completed', 'failed', 'cancelled'] as const) {
      const d = makeDelegation({ status })
      expect(computeDueAt(d)).toBeNull()
    }
  })

  it('computes correct due date for risk B (24h)', () => {
    const createdAt = '2026-01-01T00:00:00.000Z'
    const d = makeDelegation({ createdAt, riskClass: 'B' })
    const due = computeDueAt(d)
    expect(due?.toISOString()).toBe('2026-01-02T00:00:00.000Z')
  })

  it('computes correct due date for risk C (8h)', () => {
    const createdAt = '2026-01-01T00:00:00.000Z'
    const d = makeDelegation({ createdAt, riskClass: 'C' })
    const due = computeDueAt(d)
    expect(due?.toISOString()).toBe('2026-01-01T08:00:00.000Z')
  })
})

describe('getSlaStatus', () => {
  it('returns na for completed delegation', () => {
    const d = makeDelegation({ status: 'completed' })
    expect(getSlaStatus(d)).toBe('na')
  })

  it('returns ok when plenty of time remains', () => {
    const createdAt = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString() // 1h ago
    const d = makeDelegation({ createdAt, riskClass: 'B', status: 'running' }) // 24h SLA, 23h left = ok
    expect(getSlaStatus(d)).toBe('ok')
  })

  it('returns warning when ≤25% time remains', () => {
    // B=24h, warning starts at <6h remaining → 19h elapsed
    const createdAt = new Date(Date.now() - 19 * 60 * 60 * 1000).toISOString()
    const d = makeDelegation({ createdAt, riskClass: 'B', status: 'pending' })
    expect(getSlaStatus(d)).toBe('warning')
  })

  it('returns breached when past due', () => {
    const createdAt = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString() // 25h ago, 24h SLA
    const d = makeDelegation({ createdAt, riskClass: 'B', status: 'pending' })
    expect(getSlaStatus(d)).toBe('breached')
  })
})

describe('formatSlaRemaining', () => {
  it('returns empty string for terminal delegation', () => {
    const d = makeDelegation({ status: 'completed' })
    expect(formatSlaRemaining(d)).toBe('')
  })

  it('formats remaining time with hours and minutes', () => {
    const createdAt = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() // 2h ago, 22h left
    const d = makeDelegation({ createdAt, riskClass: 'B', status: 'running' })
    const result = formatSlaRemaining(d)
    expect(result).toMatch(/^\d+h/)
  })

  it('formats overdue with "Überfällig seit"', () => {
    const createdAt = new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString()
    const d = makeDelegation({ createdAt, riskClass: 'B', status: 'pending' })
    const result = formatSlaRemaining(d)
    expect(result).toContain('Überfällig seit')
  })
})
