import { describe, it, expect } from 'vitest'
import { runSaaSAudit } from './saas-audit'
import type { GapSeverity } from './saas-audit'

const VALID_SEVERITIES: GapSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
const VALID_STATUSES = ['missing', 'partial', 'done']

describe('runSaaSAudit', () => {
  it('returns a report with the correct shape', () => {
    const report = runSaaSAudit({})
    expect(typeof report.score).toBe('number')
    expect(Array.isArray(report.gaps)).toBe(true)
    expect(typeof report.readyForSolo).toBe('boolean')
    expect(typeof report.readyForSaaS).toBe('boolean')
    expect(typeof report.generatedAt).toBe('string')
    expect(new Date(report.generatedAt).toISOString()).toBe(report.generatedAt)
  })

  it('score is a number between 0 and 100', () => {
    const report = runSaaSAudit({})
    expect(report.score).toBeGreaterThanOrEqual(0)
    expect(report.score).toBeLessThanOrEqual(100)
  })

  it('score increases when auth is enabled', () => {
    const withoutAuth = runSaaSAudit({})
    const withAuth = runSaaSAudit({ FORGEPILOT_AUTH_ENABLED: 'true' })
    expect(withAuth.score).toBeGreaterThan(withoutAuth.score)
  })

  it('readyForSolo is true only when score >= 60', () => {
    const report = runSaaSAudit({})
    expect(report.readyForSolo).toBe(report.score >= 60)
  })

  it('readyForSaaS is true only when score >= 85', () => {
    const report = runSaaSAudit({})
    expect(report.readyForSaaS).toBe(report.score >= 85)
  })

  it('gaps array contains all expected gap IDs', () => {
    const report = runSaaSAudit({})
    const expectedIds = [
      'auth',
      'onboarding',
      'multi-tenancy',
      'billing',
      'e2e-tests',
      'error-monitoring',
      'rate-limiting',
      'data-backup',
      'health-checks',
      'public-docs',
    ]
    const actualIds = report.gaps.map(g => g.id)
    for (const id of expectedIds) {
      expect(actualIds).toContain(id)
    }
  })

  it('all gaps have valid severity values', () => {
    const report = runSaaSAudit({})
    for (const gap of report.gaps) {
      expect(VALID_SEVERITIES).toContain(gap.severity)
    }
  })

  it('all gaps have valid status values', () => {
    const report = runSaaSAudit({})
    for (const gap of report.gaps) {
      expect(VALID_STATUSES).toContain(gap.status)
    }
  })

  it('rate-limiting gap is always done', () => {
    const report = runSaaSAudit({})
    const rateLimitGap = report.gaps.find(g => g.id === 'rate-limiting')
    expect(rateLimitGap?.status).toBe('done')
  })

  it('multi-tenancy gap is always missing', () => {
    const report = runSaaSAudit({})
    const mtGap = report.gaps.find(g => g.id === 'multi-tenancy')
    expect(mtGap?.status).toBe('missing')
    expect(mtGap?.effortDays).toBe(21)
  })

  it('error-monitoring is done when SENTRY_DSN is set', () => {
    const report = runSaaSAudit({ SENTRY_DSN: 'https://example@sentry.io/1' })
    const gap = report.gaps.find(g => g.id === 'error-monitoring')
    expect(gap?.status).toBe('done')
  })

  it('error-monitoring is missing when SENTRY_DSN is not set', () => {
    const report = runSaaSAudit({})
    const gap = report.gaps.find(g => g.id === 'error-monitoring')
    expect(gap?.status).toBe('missing')
  })
})
