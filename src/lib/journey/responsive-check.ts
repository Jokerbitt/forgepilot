/**
 * Journey Companion — Phase 3.1: mobile / responsive readiness check.
 *
 * Static heuristic (no browser needed): scans the app for responsive signals
 * (viewport meta tag, responsive Tailwind classes / media queries) and
 * anti-patterns (hard-coded pixel widths), then produces a plain-German report
 * and a 0–100 readiness score. Read-only; grep-based.
 */
import { execFileSync } from 'child_process'
import { existsSync } from 'fs'

export interface ResponsiveReport {
  score: number
  hasViewportMeta: boolean
  usesResponsiveClasses: boolean
  usesMediaQueries: boolean
  fixedWidthHits: number
  findings: string[]
  summary: string
}

/** Count files matching a pattern (0 on no match / error). */
function countMatches(repoPath: string, pattern: string): number {
  const dirs = ['src', 'app', 'pages', 'components', 'styles'].map(d => `${repoPath}/${d}`).filter(existsSync)
  if (dirs.length === 0) return 0
  try {
    const out = execFileSync(
      'grep',
      ['-rIlE', '--include=*.tsx', '--include=*.jsx', '--include=*.html', '--include=*.css', '--include=*.scss', '-e', pattern, ...dirs],
      { timeout: 5000, maxBuffer: 4 * 1024 * 1024, encoding: 'utf8' },
    ).trim()
    return out ? out.split('\n').filter(Boolean).length : 0
  } catch {
    return 0
  }
}

/** Run the responsive readiness check on an app repo. */
export function checkResponsive(repoPath: string): ResponsiveReport {
  const exists = existsSync(repoPath)
  if (!exists) {
    return { score: 0, hasViewportMeta: false, usesResponsiveClasses: false, usesMediaQueries: false, fixedWidthHits: 0, findings: ['Pfad nicht gefunden'], summary: 'Pfad nicht gefunden — kein Check möglich.' }
  }

  const hasViewportMeta = countMatches(repoPath, 'viewport') > 0 || countMatches(repoPath, 'width=device-width') > 0
  const responsiveClassHits = countMatches(repoPath, '(sm|md|lg|xl):[a-z]')
  const mediaQueryHits = countMatches(repoPath, '@media')
  const fixedWidthHits = countMatches(repoPath, 'width:[[:space:]]*[0-9]{3,}px|w-\\[[0-9]{3,}px\\]')

  const usesResponsiveClasses = responsiveClassHits > 0
  const usesMediaQueries = mediaQueryHits > 0

  let score = 0
  const findings: string[] = []
  if (hasViewportMeta) score += 35
  else findings.push('Kein Viewport-Meta-Tag — auf dem Handy wird die Seite herausgezoomt dargestellt.')
  if (usesResponsiveClasses || usesMediaQueries) score += 45
  else findings.push('Keine responsiven Stile (Breakpoints/Media-Queries) gefunden — Layout passt sich nicht an kleine Bildschirme an.')
  if (fixedWidthHits === 0) score += 20
  else findings.push(`${fixedWidthHits} Datei(en) mit festen Pixel-Breiten (≥100px) — können auf dem Handy überlaufen.`)

  const summary = score >= 80
    ? `Gute mobile Bereitschaft (${score}/100).`
    : score >= 50
      ? `Teilweise mobil-tauglich (${score}/100) — kleinere Anpassungen empfohlen.`
      : `Noch nicht mobil-tauglich (${score}/100) — Responsive-Verbesserungen empfohlen.`

  return { score, hasViewportMeta, usesResponsiveClasses, usesMediaQueries, fixedWidthHits, findings, summary }
}
