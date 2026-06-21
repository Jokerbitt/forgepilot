/**
 * Reverse-Engineering — render a ReverseReport as Markdown for knowledge writeback.
 *
 * Pure function: turns the analysis into a portable Markdown document the user
 * can save to their knowledge base / NAS or attach to a rebuild. No I/O here.
 */
import type { ReverseReport } from './analyze'

export function renderReportMarkdown(report: ReverseReport): string {
  const lines: string[] = []
  lines.push(`# Reverse-Engineering-Report — ${report.appName}`)
  lines.push('')
  lines.push(`_Quelle: ${report.rootPath}_`)
  lines.push('')

  if (report.criticality.level !== 'normal') {
    const icon = report.criticality.level === 'critical' ? '⛔' : '⚠'
    lines.push(`> ${icon} **Kritikalität: ${report.criticality.level}** — ${report.criticality.reasons.join('; ')}`)
    lines.push('')
  }

  lines.push('## Überblick')
  lines.push(report.summary)
  lines.push('')

  lines.push('## Technik')
  lines.push(`- **Sprachen:** ${report.languages.length ? report.languages.map(l => `${l.name} (${l.fileCount})`).join(', ') : '–'}`)
  lines.push(`- **Frameworks:** ${report.frameworks.length ? report.frameworks.join(', ') : '–'}`)
  lines.push(`- **Plattform:** ${report.platform}${report.platformReasons.length ? ` (${report.platformReasons.join('; ')})` : ''}`)
  lines.push(`- **Datenbank:** ${report.databaseEngines.length ? report.databaseEngines.join(', ') : '–'}`)
  lines.push(`- **Module:** ${report.modules.length ? report.modules.join(', ') : '–'}`)
  lines.push('')

  if (report.security.length) {
    lines.push('## Sicherheit')
    for (const s of report.security) lines.push(`- ${s}`)
    lines.push('')
  }

  if (report.techDebt.length) {
    lines.push('## Tech-Schulden / Modernisierung')
    for (const d of report.techDebt) lines.push(`- ${d}`)
    lines.push('')
  }

  if (report.stackTranslations.length) {
    lines.push('## Empfohlene Modernisierung (alt → neu)')
    for (const t of report.stackTranslations) lines.push(`- **${t.from}** → ${t.to} — ${t.rationale}`)
    lines.push('')
  }

  lines.push('---')
  lines.push('_Hinweis: Ein Nachbau ist eine Annäherung — „Logik 1:1" muss per Paritäts-Test gegen das Original bewiesen werden._')
  lines.push('')
  return lines.join('\n')
}

/** Safe filename for a saved report. `stamp` is injected (no Date in pure code). */
export function reportFileName(report: ReverseReport, stamp: string): string {
  const slug = report.appName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'app'
  return `reverse-${slug}-${stamp}.md`
}
