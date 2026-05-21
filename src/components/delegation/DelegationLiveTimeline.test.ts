import { describe, it, expect } from 'vitest'
import {
  getLatestLog,
  budgetPercent,
  costBarColor,
  riskBadgeClass,
  statusIconName,
  buildTraceUrl,
} from './DelegationLiveTimeline'
import type { AgentLog } from '@/lib/models/delegation'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeLog(message: string, type: AgentLog['type'] = 'info'): AgentLog {
  return { timestamp: new Date().toISOString(), type, message }
}

// ── getLatestLog ──────────────────────────────────────────────────────────────

describe('getLatestLog', () => {
  it('returns undefined for undefined logs', () => {
    expect(getLatestLog(undefined)).toBeUndefined()
  })

  it('returns undefined for empty array', () => {
    expect(getLatestLog([])).toBeUndefined()
  })

  it('returns the last log entry', () => {
    const logs = [makeLog('first'), makeLog('second'), makeLog('third')]
    expect(getLatestLog(logs)?.message).toBe('third')
  })

  it('returns the only entry when there is one', () => {
    const logs = [makeLog('only one')]
    expect(getLatestLog(logs)?.message).toBe('only one')
  })
})

// ── budgetPercent ─────────────────────────────────────────────────────────────

describe('budgetPercent', () => {
  it('returns 0 when actualCostUsd is undefined', () => {
    expect(budgetPercent(undefined, 1.0)).toBe(0)
  })

  it('returns 0 when maxBudgetUsd is 0', () => {
    expect(budgetPercent(0.5, 0)).toBe(0)
  })

  it('calculates percentage correctly', () => {
    expect(budgetPercent(0.5, 1.0)).toBe(50)
  })

  it('clamps to 100 when over budget', () => {
    expect(budgetPercent(2.0, 1.0)).toBe(100)
  })

  it('rounds to nearest integer', () => {
    expect(budgetPercent(0.333, 1.0)).toBe(33)
  })

  it('returns 0 when actualCostUsd is 0', () => {
    expect(budgetPercent(0, 1.0)).toBe(0)
  })
})

// ── costBarColor ──────────────────────────────────────────────────────────────

describe('costBarColor', () => {
  it('returns rose for >= 90%', () => {
    expect(costBarColor(90)).toBe('bg-rose-500')
    expect(costBarColor(100)).toBe('bg-rose-500')
  })

  it('returns amber for >= 70% and < 90%', () => {
    expect(costBarColor(70)).toBe('bg-amber-500')
    expect(costBarColor(89)).toBe('bg-amber-500')
  })

  it('returns emerald for < 70%', () => {
    expect(costBarColor(0)).toBe('bg-emerald-500')
    expect(costBarColor(69)).toBe('bg-emerald-500')
  })
})

// ── riskBadgeClass ────────────────────────────────────────────────────────────

describe('riskBadgeClass', () => {
  it('returns rose classes for Risk C', () => {
    expect(riskBadgeClass('C')).toContain('rose')
  })

  it('returns amber classes for Risk B', () => {
    expect(riskBadgeClass('B')).toContain('amber')
  })

  it('returns emerald classes for Risk A', () => {
    expect(riskBadgeClass('A')).toContain('emerald')
  })
})

// ── statusIconName ────────────────────────────────────────────────────────────

describe('statusIconName', () => {
  it('returns "radio" for running', () => {
    expect(statusIconName('running')).toBe('radio')
  })

  it('returns "check" for completed', () => {
    expect(statusIconName('completed')).toBe('check')
  })

  it('returns "x" for failed', () => {
    expect(statusIconName('failed')).toBe('x')
  })

  it('returns "circle" for other statuses', () => {
    expect(statusIconName('pending')).toBe('circle')
    expect(statusIconName('approved')).toBe('circle')
    expect(statusIconName('cancelled')).toBe('circle')
  })
})

// ── buildTraceUrl ─────────────────────────────────────────────────────────────

describe('buildTraceUrl', () => {
  it('returns undefined when traceId is undefined', () => {
    expect(buildTraceUrl(undefined, 'http://localhost:16686')).toBeUndefined()
  })

  it('returns undefined when baseUrl is empty and env not set', () => {
    expect(buildTraceUrl('abc123', '')).toBeUndefined()
  })

  it('builds correct Jaeger URL', () => {
    const url = buildTraceUrl('abc123', 'http://localhost:16686')
    expect(url).toBe('http://localhost:16686/trace/abc123')
  })

  it('trims trailing slash from base URL', () => {
    const url = buildTraceUrl('def456', 'http://localhost:16686/')
    expect(url).toBe('http://localhost:16686/trace/def456')
  })

  it('works with Honeycomb-style base URL', () => {
    const url = buildTraceUrl('trace-99', 'https://ui.honeycomb.io/team/datasets/forgepilot')
    expect(url).toBe('https://ui.honeycomb.io/team/datasets/forgepilot/trace/trace-99')
  })
})
