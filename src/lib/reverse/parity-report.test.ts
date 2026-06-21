import { describe, it, expect } from 'vitest'
import { buildParityReport } from './parity-report'
import type { ReverseReport } from './analyze'
import type { SecurityFinding } from './security-scan'

const finding = (category: string): SecurityFinding => ({ severity: 'high', category, message: 'x' })

function report(over: Partial<ReverseReport>): ReverseReport {
  return {
    rootPath: '/x', appName: 'App', languages: [], frameworks: [], platform: 'unknown', platformReasons: [],
    databaseEngines: [], modules: [], security: [], securityFindings: [], techDebt: [],
    criticality: { level: 'normal', reasons: [] }, stackTranslations: [], summary: '',
    ...over,
  }
}

describe('buildParityReport', () => {
  it('scores a fully modernized rebuild at/near 100', () => {
    const original = report({ platform: 'windows', databaseEngines: ['Microsoft SQL Server'], securityFindings: [finding('Hardcoded Secret'), finding('SQL Injection')] })
    const rebuilt = report({ appName: 'App v2', platform: 'cross-platform', databaseEngines: ['PostgreSQL'], frameworks: ['Flask'], languages: [{ name: 'Python', fileCount: 12 }] })
    const r = buildParityReport(original, rebuilt, { migrateDatabase: 'PostgreSQL' })
    expect(r.score).toBe(100)
    expect(r.headline).toMatch(/✅/)
    expect(r.checks.every(c => c.status === 'ok')).toBe(true)
  })

  it('flags open goals when the rebuild is empty', () => {
    const original = report({ platform: 'windows', databaseEngines: ['Microsoft SQL Server'], securityFindings: [finding('Weak Crypto')] })
    const rebuilt = report({}) // nothing built yet
    const r = buildParityReport(original, rebuilt, { migrateDatabase: 'PostgreSQL' })
    expect(r.score).toBeLessThan(60)
    expect(r.headline).toMatch(/🔴/)
    expect(r.checks.some(c => c.aspect === 'Substanz' && c.status === 'open')).toBe(true)
  })

  it('omits the DB check when no migration was requested', () => {
    const r = buildParityReport(report({}), report({ frameworks: ['Next.js'], languages: [{ name: 'TypeScript', fileCount: 5 }] }))
    expect(r.checks.some(c => c.aspect.startsWith('Datenbank-Migration'))).toBe(false)
  })

  it('marks DB migration partial when the old DB still shows up', () => {
    const original = report({ databaseEngines: ['Microsoft SQL Server'] })
    const rebuilt = report({ databaseEngines: ['PostgreSQL', 'Microsoft SQL Server'], frameworks: ['Next.js'], languages: [{ name: 'TypeScript', fileCount: 5 }] })
    const r = buildParityReport(original, rebuilt, { migrateDatabase: 'PostgreSQL' })
    const dbCheck = r.checks.find(c => c.aspect.startsWith('Datenbank-Migration'))
    expect(dbCheck?.status).toBe('partial')
  })
})
