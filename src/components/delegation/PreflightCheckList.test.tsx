import { describe, it, expect } from 'vitest'
import type { PreflightCheck, PreflightResult } from '@/lib/preflight'

// Test the data-shape logic for preflight results (UI tested via E2E)

function summarize(result: PreflightResult): { header: string } {
  if (result.blockers.length > 0) return { header: `${result.blockers.length} Blocker gefunden` }
  if (result.warnings.length > 0) {
    const n = result.warnings.length
    return { header: `${n} Warnung${n !== 1 ? 'en' : ''}` }
  }
  return { header: 'Alle Checks bestanden' }
}

function makeCheck(overrides: Partial<PreflightCheck>): PreflightCheck {
  return {
    id: 'test',
    label: 'Test Check',
    passed: true,
    severity: 'blocking',
    ...overrides,
  }
}

function makeResult(checks: PreflightCheck[]): PreflightResult {
  const blockers = checks.filter(c => !c.passed && c.severity === 'blocking')
  const warnings = checks.filter(c => !c.passed && c.severity === 'warning')
  return { canStart: blockers.length === 0, checks, blockers, warnings }
}

describe('preflight result summarize', () => {
  it('all passed → correct header', () => {
    const r = makeResult([makeCheck({ passed: true })])
    expect(summarize(r).header).toBe('Alle Checks bestanden')
  })

  it('1 blocker → singular header', () => {
    const r = makeResult([makeCheck({ passed: false, severity: 'blocking' })])
    expect(summarize(r).header).toBe('1 Blocker gefunden')
  })

  it('2 blockers → plural header', () => {
    const r = makeResult([
      makeCheck({ id: 'a', passed: false, severity: 'blocking' }),
      makeCheck({ id: 'b', passed: false, severity: 'blocking' }),
    ])
    expect(summarize(r).header).toBe('2 Blocker gefunden')
  })

  it('1 warning (no blockers) → singular', () => {
    const r = makeResult([makeCheck({ passed: false, severity: 'warning' })])
    expect(summarize(r).header).toBe('1 Warnung')
  })

  it('2 warnings (no blockers) → plural', () => {
    const r = makeResult([
      makeCheck({ id: 'a', passed: false, severity: 'warning' }),
      makeCheck({ id: 'b', passed: false, severity: 'warning' }),
    ])
    expect(summarize(r).header).toBe('2 Warnungen')
  })

  it('blocker takes priority over warnings in header', () => {
    const r = makeResult([
      makeCheck({ id: 'a', passed: false, severity: 'blocking' }),
      makeCheck({ id: 'b', passed: false, severity: 'warning' }),
    ])
    expect(summarize(r).header).toContain('Blocker')
  })

  it('canStart false when blockers present', () => {
    const r = makeResult([makeCheck({ passed: false, severity: 'blocking' })])
    expect(r.canStart).toBe(false)
  })

  it('canStart true when only warnings', () => {
    const r = makeResult([makeCheck({ passed: false, severity: 'warning' })])
    expect(r.canStart).toBe(true)
  })

  it('canStart true when all pass', () => {
    const r = makeResult([makeCheck({ passed: true })])
    expect(r.canStart).toBe(true)
  })
})
