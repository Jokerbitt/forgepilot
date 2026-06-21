/**
 * Reverse-Engineering — stack translation map.
 *
 * Turns a ReverseReport into concrete "old → new" technology recommendations for
 * a cross-platform rebuild (e.g. WinForms → React/Next.js, MSSQL → PostgreSQL).
 * Pure mapping logic; feeds the report and can pre-fill the rebuild's targetStack.
 */
import type { ReverseReport } from './analyze'

export interface StackTranslation {
  /** What was detected. */
  from: string
  /** Recommended modern, cross-platform replacement. */
  to: string
  /** Short German rationale. */
  rationale: string
}

interface Rule {
  /** Matches a framework string, language name, or database engine. */
  match: (r: ReverseReport) => boolean
  from: string
  to: string
  rationale: string
}

const RULES: Rule[] = [
  {
    match: r => r.frameworks.includes('WinForms') || r.frameworks.includes('WPF/XAML'),
    from: 'WinForms / WPF (Windows-Desktop-UI)',
    to: 'Web-UI mit Next.js + React (oder Avalonia/.NET MAUI für native cross-platform Desktop-UI)',
    rationale: 'Ersetzt die Windows-gebundene Oberfläche durch eine plattformunabhängige.',
  },
  {
    match: r => r.databaseEngines.includes('Microsoft SQL Server'),
    from: 'Microsoft SQL Server (MSSQL)',
    to: 'PostgreSQL mit Prisma (TS) bzw. EF Core (C#)',
    rationale: 'Offen, lizenzkostenfrei, läuft überall; Schema + Queries werden migriert.',
  },
  {
    match: r => r.frameworks.includes('.NET') && r.platform === 'windows',
    from: '.NET Framework (net4x, Windows-only)',
    to: '.NET 8 (cross-platform) — oder Node.js/TypeScript bei Web-Fokus',
    rationale: 'Aktuelle Laufzeit läuft auf Linux/Mac/Windows und ist Docker-fähig.',
  },
  {
    match: r => r.frameworks.includes('Entity Framework Core'),
    from: 'Entity Framework Core',
    to: 'EF Core mit PostgreSQL-Provider (Npgsql) — oder Prisma bei TS-Port',
    rationale: 'Datenzugriff bleibt erhalten, nur der DB-Provider wechselt.',
  },
  {
    match: r => r.languages.some(l => l.name === 'C#') && !r.frameworks.includes('.NET'),
    from: 'C#-Codebasis',
    to: 'Portierung nach TypeScript (Web) oder .NET 8 (cross-platform)',
    rationale: 'Geschäftslogik gleichwertig übertragen; UI separat modernisieren.',
  },
]

/** Build the translation suggestions for a report (deduped by `from`). */
export function suggestStackTranslations(report: ReverseReport): StackTranslation[] {
  const out: StackTranslation[] = []
  const seen = new Set<string>()
  for (const rule of RULES) {
    if (rule.match(report) && !seen.has(rule.from)) {
      seen.add(rule.from)
      out.push({ from: rule.from, to: rule.to, rationale: rule.rationale })
    }
  }
  return out
}

/** Derive a one-line targetStack string from the translations (for the rebuild plan). */
export function deriveTargetStack(translations: StackTranslation[]): string | undefined {
  if (translations.length === 0) return undefined
  const ui = translations.find(t => t.to.includes('Next.js'))
  const db = translations.find(t => t.to.includes('PostgreSQL'))
  const parts: string[] = []
  if (ui) parts.push('Next.js + React')
  if (db) parts.push('PostgreSQL')
  return parts.length ? parts.join(' + ') : undefined
}
