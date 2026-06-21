import { describe, it, expect } from 'vitest'
import { renderReportMarkdown, reportFileName } from './report-markdown'
import type { ReverseReport } from './analyze'

function report(over: Partial<ReverseReport> = {}): ReverseReport {
  return {
    rootPath: '/tmp/leit', appName: 'Leitrechner',
    languages: [{ name: 'C#', fileCount: 12 }], frameworks: ['WinForms', '.NET'],
    platform: 'windows', platformReasons: ['WinForms'], databaseEngines: ['Microsoft SQL Server'],
    modules: ['App.Core'], security: ['🔴 Hardcoded Secret: ...'], securityFindings: [],
    techDebt: ['Windows + MSSQL → PostgreSQL'],
    criticality: { level: 'critical', reasons: ['SCADA'] },
    stackTranslations: [{ from: 'WinForms', to: 'Next.js + React', rationale: 'plattformunabhängig' }],
    summary: 'Zusammenfassung …',
    ...over,
  }
}

describe('renderReportMarkdown', () => {
  it('renders all sections with the app name as heading', () => {
    const md = renderReportMarkdown(report())
    expect(md).toContain('# Reverse-Engineering-Report — Leitrechner')
    expect(md).toContain('## Technik')
    expect(md).toContain('Microsoft SQL Server')
    expect(md).toContain('## Sicherheit')
    expect(md).toContain('## Empfohlene Modernisierung')
    expect(md).toMatch(/1:1/)
  })

  it('includes a criticality warning when not normal', () => {
    expect(renderReportMarkdown(report())).toMatch(/Kritikalität: critical/)
  })

  it('omits optional sections when empty', () => {
    const md = renderReportMarkdown(report({ security: [], techDebt: [], stackTranslations: [], criticality: { level: 'normal', reasons: [] } }))
    expect(md).not.toContain('## Sicherheit')
    expect(md).not.toContain('Kritikalität')
  })
})

describe('reportFileName', () => {
  it('builds a safe slugged filename with the stamp', () => {
    expect(reportFileName(report(), '20260620')).toBe('reverse-leitrechner-20260620.md')
  })
})
