import { describe, it, expect } from 'vitest'
import { reportToRebuildSteps } from './to-rebuild-plan'
import type { ReverseReport } from './analyze'

function report(over: Partial<ReverseReport> = {}): ReverseReport {
  return {
    rootPath: '/tmp/x',
    appName: 'Leitrechner',
    languages: [{ name: 'C#', fileCount: 50 }],
    frameworks: ['WinForms', '.NET'],
    platform: 'windows',
    platformReasons: ['WinForms'],
    databaseEngines: ['Microsoft SQL Server'],
    modules: ['App.Core', 'App.UI'],
    security: ['Mögliche hartkodierte Zugangsdaten'],
    securityFindings: [],
    techDebt: [],
    criticality: { level: 'normal', reasons: [] },
    summary: '',
    ...over,
  }
}

describe('reportToRebuildSteps', () => {
  it('always starts with scaffolding and ends with validation', () => {
    const steps = reportToRebuildSteps(report())
    expect(steps[0]!.title).toMatch(/Architektur/)
    expect(steps.some(s => s.title === 'App validieren')).toBe(true)
  })

  it('adds a DB migration step with the source engine named', () => {
    const steps = reportToRebuildSteps(report(), { migrateDatabase: 'PostgreSQL' })
    const mig = steps.find(s => s.title.includes('PostgreSQL'))
    expect(mig).toBeTruthy()
    expect(mig!.description).toContain('Microsoft SQL Server')
  })

  it('creates one port step per module', () => {
    const steps = reportToRebuildSteps(report())
    expect(steps.some(s => s.title.includes('App.Core'))).toBe(true)
    expect(steps.some(s => s.title.includes('App.UI'))).toBe(true)
  })

  it('caps module steps and adds a remainder step', () => {
    const many = Array.from({ length: 12 }, (_, i) => `Mod${i}`)
    const steps = reportToRebuildSteps(report({ modules: many }), { maxModuleSteps: 3 })
    const portSteps = steps.filter(s => s.title.startsWith('Modul'))
    expect(portSteps).toHaveLength(3)
    expect(steps.some(s => s.title === 'Restliche Module portieren')).toBe(true)
  })

  it('includes security findings verbatim when fixSecurity is set', () => {
    const steps = reportToRebuildSteps(report(), { fixSecurity: true })
    const sec = steps.find(s => s.title === 'Sicherheitslücken beheben')
    expect(sec!.description).toContain('hartkodierte Zugangsdaten')
  })

  it('adds a parity-test step (no 1:1 promise) when preserveLogic is set', () => {
    const steps = reportToRebuildSteps(report(), { preserveLogic: true })
    const parity = steps.find(s => s.title.includes('Parität'))
    expect(parity).toBeTruthy()
    expect(parity!.description).toMatch(/1:1/)
  })

  it('auto-adds cross-platform step for a windows app and dedupes with the option', () => {
    const steps = reportToRebuildSteps(report({ platform: 'windows' }), { crossPlatform: true })
    expect(steps.filter(s => s.title === 'Plattformunabhängig machen')).toHaveLength(1)
  })

  it('falls back to a single core-logic step when no modules', () => {
    const steps = reportToRebuildSteps(report({ modules: [] }))
    expect(steps.some(s => s.title.includes('Kern-Geschäftslogik'))).toBe(true)
  })
})
