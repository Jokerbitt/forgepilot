/**
 * Reverse-Engineering — parity report (read-only, structural).
 *
 * Compares the ORIGINAL analysis with an analysis of the REBUILD and reports,
 * in plain German, which modernization goals are demonstrably met (platform,
 * DB migration, security, modern stack, substance).
 *
 * Honesty: this is a STRUCTURAL parity overview, NOT a proof of "logic 1:1".
 * Behavioural equivalence is still proven by the parity-TEST build step
 * (to-rebuild-plan.ts). Pure + unit-testable: takes two ReverseReports.
 */
import type { ReverseReport } from './analyze'

export type ParityStatus = 'ok' | 'partial' | 'open'

export interface ParityCheck {
  aspect: string
  status: ParityStatus
  /** Plain-German detail. */
  detail: string
}

export interface ParityOptions {
  /** The database the rebuild was supposed to migrate to, e.g. "PostgreSQL". */
  migrateDatabase?: string
}

export interface ParityReport {
  /** 0–100 — share of modernization goals met (ok=1, partial=0.5, open=0). */
  score: number
  headline: string
  checks: ParityCheck[]
}

const WEIGHT: Record<ParityStatus, number> = { ok: 1, partial: 0.5, open: 0 }

/** Compare original vs. rebuild and produce a plain-German parity overview. */
export function buildParityReport(
  original: ReverseReport,
  rebuilt: ReverseReport,
  opts: ParityOptions = {},
): ParityReport {
  const name = rebuilt.appName?.trim() || original.appName?.trim() || 'Der Nachbau'
  const checks: ParityCheck[] = []

  // 1) Platform independence — only relevant if the original was Windows-bound.
  if (original.platform === 'windows') {
    const ok = rebuilt.platform === 'cross-platform'
    checks.push({
      aspect: 'Plattformunabhängigkeit',
      status: ok ? 'ok' : 'open',
      detail: ok
        ? 'Der Nachbau ist plattformunabhängig (das Original war Windows-gebunden).'
        : 'Der Nachbau wirkt noch nicht eindeutig plattformunabhängig.',
    })
  }

  // 2) Database migration — only if a target DB was requested.
  if (opts.migrateDatabase) {
    const target = opts.migrateDatabase
    const t = target.toLowerCase()
    const hasTarget = rebuilt.databaseEngines.some(d => d.toLowerCase().includes(t))
    const oldStillThere = original.databaseEngines.some(
      d => !d.toLowerCase().includes(t) && rebuilt.databaseEngines.includes(d),
    )
    const status: ParityStatus = hasTarget && !oldStillThere ? 'ok' : hasTarget ? 'partial' : 'open'
    checks.push({
      aspect: `Datenbank-Migration → ${target}`,
      status,
      detail:
        status === 'ok'
          ? `Ziel-Datenbank ${target} erkannt, keine Spur der alten Datenbank mehr.`
          : status === 'partial'
            ? `Ziel-Datenbank ${target} erkannt, aber die alte Datenbank ist noch sichtbar.`
            : `Ziel-Datenbank ${target} im Nachbau (noch) nicht erkannt.`,
    })
  }

  // 3) Security — only if the original had findings to fix.
  const before = original.securityFindings.length
  if (before > 0) {
    const after = rebuilt.securityFindings.length
    const status: ParityStatus = after === 0 ? 'ok' : after < before ? 'partial' : 'open'
    checks.push({
      aspect: 'Sicherheitslücken behoben',
      status,
      detail: `Original: ${before} Fund(e) · Nachbau: ${after} Fund(e).`,
    })
  }

  // 4) Modern stack — a framework should be detectable in the rebuild.
  const stackOk = rebuilt.frameworks.length > 0
  checks.push({
    aspect: 'Moderner Stack',
    status: stackOk ? 'ok' : 'open',
    detail: stackOk
      ? `Nachbau nutzt: ${rebuilt.frameworks.join(', ')}.`
      : 'Im Nachbau wurde noch kein modernes Framework erkannt.',
  })

  // 5) Substance — the rebuild must actually contain code.
  const fileCount = rebuilt.languages.reduce((sum, l) => sum + l.fileCount, 0)
  const substanceOk = fileCount >= 3
  checks.push({
    aspect: 'Substanz',
    status: substanceOk ? 'ok' : 'open',
    detail: substanceOk
      ? `Der Nachbau enthält ${fileCount} Quelldatei(en).`
      : 'Der Nachbau enthält kaum Code — vermutlich noch nicht (fertig) gebaut.',
  })

  const score = checks.length
    ? Math.round((checks.reduce((sum, c) => sum + WEIGHT[c.status], 0) / checks.length) * 100)
    : 0
  const openCount = checks.filter(c => c.status === 'open').length

  let headline: string
  if (checks.length === 0) {
    headline = `${name}: nichts zu vergleichen.`
  } else if (score >= 90) {
    headline = `✅ ${name}: Paritäts-Check ${score}/100 — der Nachbau deckt die Modernisierungsziele.`
  } else if (score >= 60) {
    headline = `🟡 ${name}: Paritäts-Check ${score}/100 — überwiegend erreicht, ${openCount} Punkt(e) offen.`
  } else {
    headline = `🔴 ${name}: Paritäts-Check ${score}/100 — wesentliche Ziele noch offen.`
  }

  return { score, headline, checks }
}
