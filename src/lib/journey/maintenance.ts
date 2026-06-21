/**
 * Journey Companion — Phase 3.2: periodic maintenance (security + dependencies).
 *
 * Combines the reverse security scanner with an outdated-dependency check into a
 * plain-German maintenance report, and can be run on demand or from a cron job.
 * The npm runner is injectable so dependency parsing is unit-testable.
 */
import { execFileSync } from 'child_process'
import { existsSync } from 'fs'
import { scanSecurityDeep, type SecurityFinding } from '@/lib/reverse/security-scan'

export type UpdateLevel = 'major' | 'minor' | 'patch'

export interface OutdatedDep {
  name: string
  current: string
  latest: string
  level: UpdateLevel
}

export interface MaintenanceReport {
  repoPath: string
  security: SecurityFinding[]
  outdated: OutdatedDep[]
  summary: string
}

interface NpmRunner {
  /** Run `npm outdated --json` in repoPath; return stdout (npm exits non-zero when outdated — capture anyway). */
  outdated(repoPath: string): string
}

const defaultNpmRunner: NpmRunner = {
  outdated(repoPath) {
    try {
      return execFileSync('npm', ['outdated', '--json'], { cwd: repoPath, encoding: 'utf8', timeout: 120_000, maxBuffer: 8 * 1024 * 1024 })
    } catch (e) {
      // npm outdated exits with code 1 when there ARE outdated deps; stdout still holds the JSON.
      const err = e as { stdout?: string | Buffer }
      return err.stdout ? err.stdout.toString() : ''
    }
  },
}

function majorOf(version: string): number {
  const m = version.replace(/^[^\d]*/, '').split('.')[0]
  const n = parseInt(m ?? '', 10)
  return Number.isNaN(n) ? 0 : n
}

function minorOf(version: string): number {
  const parts = version.replace(/^[^\d]*/, '').split('.')
  const n = parseInt(parts[1] ?? '', 10)
  return Number.isNaN(n) ? 0 : n
}

/** Classify the update gap between current and latest. */
export function updateLevel(current: string, latest: string): UpdateLevel {
  if (majorOf(latest) > majorOf(current)) return 'major'
  if (minorOf(latest) > minorOf(current)) return 'minor'
  return 'patch'
}

/** Parse `npm outdated --json` output into a typed, sorted list (major first). */
export function parseOutdated(jsonText: string): OutdatedDep[] {
  if (!jsonText.trim()) return []
  let parsed: Record<string, { current?: string; latest?: string }>
  try {
    parsed = JSON.parse(jsonText) as typeof parsed
  } catch {
    return []
  }
  const order: Record<UpdateLevel, number> = { major: 0, minor: 1, patch: 2 }
  const out: OutdatedDep[] = []
  for (const [name, info] of Object.entries(parsed)) {
    const current = info.current ?? ''
    const latest = info.latest ?? ''
    if (!current || !latest || current === latest) continue
    out.push({ name, current, latest, level: updateLevel(current, latest) })
  }
  return out.sort((a, b) => order[a.level] - order[b.level])
}

/** Build a maintenance report (security + outdated deps) for a repo. */
export function buildMaintenanceReport(repoPath: string, npm: NpmRunner = defaultNpmRunner): MaintenanceReport {
  if (!existsSync(repoPath)) {
    return { repoPath, security: [], outdated: [], summary: 'Pfad nicht gefunden — keine Wartungsprüfung möglich.' }
  }
  const security = scanSecurityDeep(repoPath)
  const outdated = existsSync(`${repoPath}/package.json`) ? parseOutdated(npm.outdated(repoPath)) : []

  const majors = outdated.filter(d => d.level === 'major').length
  const highSec = security.filter(s => s.severity === 'high').length
  const parts: string[] = []
  parts.push(security.length ? `${security.length} Sicherheitshinweis(e)${highSec ? ` (davon ${highSec} kritisch)` : ''}` : 'keine Sicherheitsfunde')
  parts.push(outdated.length ? `${outdated.length} veraltete Pakete${majors ? ` (${majors} große Updates)` : ''}` : 'alle Pakete aktuell')
  const summary = `Wartung: ${parts.join(', ')}.`

  return { repoPath, security, outdated, summary }
}
