import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildDigest } from './digest-builder'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/notifications/notification-store', () => ({
  readNotifications: vi.fn(() => []),
}))

vi.mock('@/lib/delegations/queue', () => ({
  readDelegations: vi.fn(() => []),
}))

vi.mock('@/lib/agent-runs/store', () => ({
  getRuns: vi.fn(() => []),
}))

import { readNotifications } from '@/lib/notifications/notification-store'
import { readDelegations } from '@/lib/delegations/queue'
import { getRuns } from '@/lib/agent-runs/store'
import type { Notification } from '@/lib/models/notification'
import type { Delegation } from '@/lib/models/delegation'
import type { AgentRun } from '@/lib/models/agent-run'

const mockNotifications = readNotifications as ReturnType<typeof vi.fn>
const mockDelegations = readDelegations as ReturnType<typeof vi.fn>
const mockRuns = getRuns as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
  mockNotifications.mockReturnValue([])
  mockDelegations.mockReturnValue([])
  mockRuns.mockReturnValue([])
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeNotif(overrides: Partial<Notification> = {}): Notification {
  return {
    id: 'n1',
    type: 'system',
    severity: 'info',
    title: 'Test',
    body: 'body',
    read: false,
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

function makeDelegation(overrides: Partial<Delegation> = {}): Delegation {
  return {
    id: 'd1',
    title: 'Test Delegation',
    status: 'completed',
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    contract: { goal: 'Do something', context: '', maxBudgetUsd: 10, allowedTools: [], privacyMode: 'local', riskClass: 'A' },
    logs: [],
    ...overrides,
  } as unknown as Delegation
}

function makeRun(overrides: Partial<AgentRun> = {}): AgentRun {
  return {
    id: 'r1',
    delegationId: 'd1',
    contractId: 'c1',
    status: 'completed',
    model: 'claude-3-haiku',
    startedAt: new Date().toISOString(),
    totalCostUsd: 0.002,
    tokenInput: 500,
    tokenOutput: 200,
    traceEvents: [],
    ...overrides,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('buildDigest', () => {
  it('returns a digest with expected shape for daily period', () => {
    const digest = buildDigest('daily')
    expect(digest.period).toBe('daily')
    expect(typeof digest.generatedAt).toBe('string')
    expect(typeof digest.since).toBe('string')
    expect(Array.isArray(digest.sections)).toBe(true)
    expect(typeof digest.emailBody).toBe('string')
    expect(typeof digest.stats).toBe('object')
  })

  it('returns weekly period', () => {
    const digest = buildDigest('weekly')
    expect(digest.period).toBe('weekly')
    // weekly since should be ~7 days earlier than daily since
    const daily = buildDigest('daily')
    expect(new Date(digest.since).getTime()).toBeLessThan(new Date(daily.since).getTime())
  })

  it('counts recent notifications correctly', () => {
    const recent = makeNotif({ createdAt: new Date().toISOString() })
    const old = makeNotif({ id: 'n2', createdAt: new Date('2000-01-01').toISOString() })
    mockNotifications.mockReturnValue([recent, old])
    const digest = buildDigest('daily')
    expect(digest.stats.totalNotifications).toBe(1)
  })

  it('counts unread and critical notifications', () => {
    mockNotifications.mockReturnValue([
      makeNotif({ read: false, severity: 'critical' }),
      makeNotif({ id: 'n2', read: true, severity: 'info' }),
    ])
    const digest = buildDigest('daily')
    expect(digest.stats.unreadNotifications).toBe(1)
    expect(digest.stats.criticalNotifications).toBe(1)
  })

  it('counts completed and failed delegations', () => {
    mockDelegations.mockReturnValue([
      makeDelegation({ status: 'completed' }),
      makeDelegation({ id: 'd2', status: 'failed' }),
      makeDelegation({ id: 'd3', status: 'running' }),
    ])
    const digest = buildDigest('daily')
    expect(digest.stats.completedDelegations).toBe(1)
    expect(digest.stats.failedDelegations).toBe(1)
    expect(digest.stats.runningDelegations).toBe(1)
  })

  it('calculates total run cost and counts', () => {
    mockRuns.mockReturnValue([
      makeRun({ totalCostUsd: 0.01, status: 'completed' }),
      makeRun({ id: 'r2', totalCostUsd: 0.005, status: 'failed' }),
    ])
    const digest = buildDigest('daily')
    expect(digest.stats.completedRuns).toBe(1)
    expect(digest.stats.failedRuns).toBe(1)
    expect(digest.stats.totalRunCostUsd).toBeCloseTo(0.015, 5)
  })

  it('includes sections for notifications, delegations and runs', () => {
    const digest = buildDigest('daily')
    const titles = digest.sections.map(s => s.title)
    expect(titles).toContain('Benachrichtigungen')
    expect(titles).toContain('Delegationen')
    expect(titles).toContain('Agent Runs')
  })

  it('emailBody contains period label', () => {
    const daily = buildDigest('daily')
    expect(daily.emailBody).toContain('Letzten 24 Stunden')
    const weekly = buildDigest('weekly')
    expect(weekly.emailBody).toContain('Letzte 7 Tage')
  })
})
