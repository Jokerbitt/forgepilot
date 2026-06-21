import { describe, it, expect } from 'vitest'
import { suggestStackTranslations, deriveTargetStack } from './stack-translation'
import type { ReverseReport } from './analyze'

function report(over: Partial<ReverseReport> = {}): ReverseReport {
  return {
    rootPath: '/x', appName: 'App', languages: [{ name: 'C#', fileCount: 10 }],
    frameworks: ['WinForms', '.NET'], platform: 'windows', platformReasons: [],
    databaseEngines: ['Microsoft SQL Server'], modules: [], security: [], securityFindings: [],
    techDebt: [], criticality: { level: 'normal', reasons: [] }, stackTranslations: [], summary: '',
    ...over,
  }
}

describe('suggestStackTranslations', () => {
  it('maps WinForms → web UI and MSSQL → PostgreSQL', () => {
    const t = suggestStackTranslations(report())
    expect(t.some(x => x.from.includes('WinForms') && x.to.includes('Next.js'))).toBe(true)
    expect(t.some(x => x.from.includes('MSSQL') && x.to.includes('PostgreSQL'))).toBe(true)
  })

  it('maps legacy .NET Framework on windows → .NET 8', () => {
    const t = suggestStackTranslations(report())
    expect(t.some(x => x.to.includes('.NET 8'))).toBe(true)
  })

  it('returns nothing for a plain cross-platform Node app', () => {
    const t = suggestStackTranslations(report({
      languages: [{ name: 'TypeScript', fileCount: 5 }], frameworks: ['Next.js', 'React'],
      platform: 'cross-platform', databaseEngines: ['PostgreSQL'],
    }))
    expect(t).toEqual([])
  })
})

describe('deriveTargetStack', () => {
  it('combines UI + DB into a one-liner', () => {
    const t = suggestStackTranslations(report())
    expect(deriveTargetStack(t)).toBe('Next.js + React + PostgreSQL')
  })
  it('returns undefined when there are no translations', () => {
    expect(deriveTargetStack([])).toBeUndefined()
  })
})
