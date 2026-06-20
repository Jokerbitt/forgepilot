/**
 * Reverse-Engineering — Slice 1: read-only deep analysis of an existing app.
 *
 * Multi-language (C#/.NET, TS/JS, Python, Java, Go, PHP, …). It builds a file
 * inventory, detects languages/frameworks, the database stack (MSSQL/PostgreSQL/…),
 * platform binding (Windows-only vs. cross-platform), sub-modules, and surfaces
 * security + tech-debt signals — then renders a plain-German report a non-techie
 * can read before deciding on a rebuild.
 *
 * Pure and read-only: never writes, never throws on a bad path (returns a
 * best-effort report). Content probes use grep (fast, no full-file loads).
 */
import { execFileSync } from 'child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'fs'
import { join, extname } from 'path'
import { scanSecurityDeep, findingsToStrings, type SecurityFinding } from './security-scan'
import { assessCriticality, type CriticalityAssessment } from './criticality'

export type Platform = 'windows' | 'cross-platform' | 'unknown'

export interface LanguageCount {
  name: string
  fileCount: number
}

export interface ReverseReport {
  rootPath: string
  appName: string
  languages: LanguageCount[]
  frameworks: string[]
  platform: Platform
  platformReasons: string[]
  /** Detected database engines (e.g. "Microsoft SQL Server", "PostgreSQL"). */
  databaseEngines: string[]
  /** Sub-projects / apps inside the codebase (e.g. .csproj names, workspace packages). */
  modules: string[]
  /** Potential security findings worth a closer look (plain strings). */
  security: string[]
  /** Structured security findings with severity + sample file. */
  securityFindings: SecurityFinding[]
  /** Heuristic tech-debt / modernization signals. */
  techDebt: string[]
  /** Safety/criticality assessment — gates autonomous rebuild. */
  criticality: CriticalityAssessment
  /** Plain-German narrative summary. */
  summary: string
}

const IGNORE_DIRS = new Set(['node_modules', '.git', '.next', 'dist', 'build', 'bin', 'obj', '.vs', '.idea', 'vendor', '__pycache__', 'packages'])
const MAX_FILES = 4000

const EXT_LANGUAGE: Record<string, string> = {
  '.cs': 'C#', '.vb': 'VB.NET',
  '.ts': 'TypeScript', '.tsx': 'TypeScript',
  '.js': 'JavaScript', '.jsx': 'JavaScript', '.mjs': 'JavaScript',
  '.py': 'Python', '.java': 'Java', '.kt': 'Kotlin', '.go': 'Go',
  '.php': 'PHP', '.rb': 'Ruby', '.rs': 'Rust', '.swift': 'Swift',
  '.cpp': 'C/C++', '.cc': 'C/C++', '.c': 'C/C++', '.h': 'C/C++', '.hpp': 'C/C++',
  '.sql': 'SQL',
}

interface WalkResult {
  files: string[]
  truncated: boolean
}

/** Bounded recursive file walk (relative paths), skipping noisy build dirs. */
export function walkFiles(root: string, maxFiles = MAX_FILES): WalkResult {
  const files: string[] = []
  let truncated = false
  const stack: string[] = ['']
  while (stack.length > 0) {
    const rel = stack.pop() as string
    const abs = rel ? join(root, rel) : root
    let entries: import('fs').Dirent[]
    try {
      entries = readdirSync(abs, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      const childRel = rel ? join(rel, entry.name) : entry.name
      if (entry.isDirectory()) {
        if (IGNORE_DIRS.has(entry.name) || entry.name.startsWith('.')) continue
        stack.push(childRel)
      } else if (entry.isFile()) {
        if (files.length >= maxFiles) { truncated = true; continue }
        files.push(childRel)
      }
    }
  }
  return { files, truncated }
}

/** Count files per language from a file list. */
export function countLanguages(files: string[]): LanguageCount[] {
  const counts = new Map<string, number>()
  for (const f of files) {
    const lang = EXT_LANGUAGE[extname(f).toLowerCase()]
    if (lang) counts.set(lang, (counts.get(lang) ?? 0) + 1)
  }
  return Array.from(counts.entries())
    .map(([name, fileCount]) => ({ name, fileCount }))
    .sort((a, b) => b.fileCount - a.fileCount)
}

/** grep a set of patterns in the repo; returns the patterns that matched at least once. */
function grepAny(root: string, patterns: string[]): Set<string> {
  const hit = new Set<string>()
  for (const pattern of patterns) {
    try {
      execFileSync('grep', ['-rIlq', '-e', pattern, root], { timeout: 5000, maxBuffer: 4 * 1024 * 1024 })
      hit.add(pattern)
    } catch {
      // exit 1 = no match; other errors fail-open (treated as no match)
    }
  }
  return hit
}

interface DetectionResult {
  frameworks: string[]
  platform: Platform
  platformReasons: string[]
  databaseEngines: string[]
}

/** Detect frameworks, platform binding and DB engines from content + marker files. */
export function detectStack(root: string, files: string[]): DetectionResult {
  const frameworks = new Set<string>()
  const databaseEngines = new Set<string>()
  const platformReasons: string[] = []
  let windowsScore = 0
  let crossScore = 0

  const hasExt = (ext: string) => files.some(f => f.toLowerCase().endsWith(ext))
  const hasFile = (name: string) => files.some(f => f === name || f.endsWith(`/${name}`))

  // .NET project markers
  if (hasExt('.csproj') || hasExt('.sln')) frameworks.add('.NET')
  if (hasExt('.xaml')) { frameworks.add('WPF/XAML'); windowsScore += 2; platformReasons.push('XAML-Dateien (WPF) — typischerweise Windows') }
  if (hasFile('package.json')) frameworks.add('Node.js')

  // Content probes (only when there is .NET / source to probe)
  const probes = grepAny(root, [
    'System.Windows.Forms', 'PresentationFramework', 'Microsoft.Win32', 'kernel32', 'user32.dll',
    'net48', 'net472', 'netframework', 'TargetFramework>net6', 'TargetFramework>net7', 'TargetFramework>net8', 'netstandard',
    'System.Data.SqlClient', 'Microsoft.Data.SqlClient', 'Npgsql', 'MySql.Data', 'Microsoft.EntityFrameworkCore', 'mongodb', 'sqlite',
    'next', 'react', 'express',
  ])
  const matched = (p: string) => probes.has(p)

  // Platform binding
  if (matched('System.Windows.Forms')) { frameworks.add('WinForms'); windowsScore += 2; platformReasons.push('WinForms (System.Windows.Forms) — Windows-only') }
  if (matched('PresentationFramework')) { windowsScore += 2; platformReasons.push('WPF (PresentationFramework) — Windows-only') }
  if (matched('Microsoft.Win32') || matched('kernel32') || matched('user32.dll')) { windowsScore += 1; platformReasons.push('Win32-/Registry-Aufrufe — Windows-spezifisch') }
  if (matched('net48') || matched('net472') || matched('netframework')) { windowsScore += 2; platformReasons.push('.NET Framework (net4x) — praktisch Windows-only') }
  if (matched('TargetFramework>net6') || matched('TargetFramework>net7') || matched('TargetFramework>net8') || matched('netstandard')) { crossScore += 2; platformReasons.push('.NET 6/7/8 / netstandard — cross-platform-fähig') }
  if (hasFile('package.json') || matched('next') || matched('react') || matched('express')) crossScore += 2

  // Frameworks
  if (matched('Microsoft.EntityFrameworkCore')) frameworks.add('Entity Framework Core')
  if (matched('next')) frameworks.add('Next.js')
  if (matched('react')) frameworks.add('React')
  if (matched('express')) frameworks.add('Express')

  // Database engines
  if (matched('System.Data.SqlClient') || matched('Microsoft.Data.SqlClient')) databaseEngines.add('Microsoft SQL Server')
  if (matched('Npgsql')) databaseEngines.add('PostgreSQL')
  if (matched('MySql.Data')) databaseEngines.add('MySQL')
  if (matched('mongodb')) databaseEngines.add('MongoDB')
  if (matched('sqlite')) databaseEngines.add('SQLite')

  let platform: Platform = 'unknown'
  if (windowsScore > crossScore && windowsScore > 0) platform = 'windows'
  else if (crossScore > windowsScore && crossScore > 0) platform = 'cross-platform'

  return { frameworks: Array.from(frameworks), platform, platformReasons, databaseEngines: Array.from(databaseEngines) }
}

/** Find sub-modules: .csproj names and workspace package dirs. */
export function findModules(files: string[]): string[] {
  const modules = new Set<string>()
  for (const f of files) {
    const lower = f.toLowerCase()
    if (lower.endsWith('.csproj')) {
      const name = f.split('/').pop()!.replace(/\.csproj$/i, '')
      modules.add(name)
    }
  }
  return Array.from(modules).slice(0, 40)
}


function appNameFrom(root: string, files: string[]): string {
  const sln = files.find(f => f.toLowerCase().endsWith('.sln'))
  if (sln) return sln.split('/').pop()!.replace(/\.sln$/i, '')
  const pkg = files.find(f => f === 'package.json')
  if (pkg) {
    try {
      const name = (JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { name?: string }).name
      if (name) return name
    } catch { /* ignore */ }
  }
  return root.split('/').filter(Boolean).pop() ?? 'app'
}

function buildSummary(r: Omit<ReverseReport, 'summary'>): string {
  const langStr = r.languages.length ? r.languages.map(l => `${l.name} (${l.fileCount})`).join(', ') : 'keine erkannt'
  const platformStr = r.platform === 'windows'
    ? 'aktuell Windows-gebunden'
    : r.platform === 'cross-platform' ? 'bereits cross-platform-fähig' : 'Plattform unklar'
  const lines = [
    `„${r.appName}" — Sprachen: ${langStr}.`,
    r.frameworks.length ? `Frameworks: ${r.frameworks.join(', ')}.` : '',
    `Plattform: ${platformStr}.`,
    r.databaseEngines.length ? `Datenbank: ${r.databaseEngines.join(', ')}.` : 'Keine Datenbank eindeutig erkannt.',
    r.modules.length ? `${r.modules.length} Teil-Modul(e)/App(s) erkannt (z. B. ${r.modules.slice(0, 5).join(', ')}).` : '',
    r.security.length ? `⚠ ${r.security.length} Sicherheitshinweis(e) gefunden.` : 'Keine offensichtlichen Sicherheitslücken im Schnellscan.',
    r.criticality.level === 'critical' ? '⛔ Kritische Steuerungssoftware erkannt — kein autonomer Nachbau ohne ausdrückliche Bestätigung.' : '',
    'Hinweis: Ein Nachbau ist eine Annäherung — „Logik 1:1" muss per Paritäts-Test gegen das Original bewiesen werden.',
  ]
  return lines.filter(Boolean).join(' ')
}

/** Run the full read-only reverse analysis on a repo/app path. */
export function analyzeForReverse(rootPath: string): ReverseReport {
  const exists = existsSync(rootPath) && (() => { try { return statSync(rootPath).isDirectory() } catch { return false } })()
  if (!exists) {
    const empty: Omit<ReverseReport, 'summary'> = {
      rootPath, appName: rootPath.split('/').filter(Boolean).pop() ?? 'app',
      languages: [], frameworks: [], platform: 'unknown', platformReasons: [],
      databaseEngines: [], modules: [], security: [], securityFindings: [], techDebt: ['Pfad nicht gefunden oder kein Verzeichnis'],
      criticality: { level: 'normal', reasons: [] },
    }
    return { ...empty, summary: 'Pfad nicht gefunden — keine Analyse möglich.' }
  }

  const { files, truncated } = walkFiles(rootPath)
  const languages = countLanguages(files)
  const { frameworks, platform, platformReasons, databaseEngines } = detectStack(rootPath, files)
  const modules = findModules(files)
  const securityFindings = scanSecurityDeep(rootPath)
  const security = findingsToStrings(securityFindings)

  const techDebt: string[] = []
  if (truncated) techDebt.push(`Sehr großes Projekt (>${MAX_FILES} Dateien) — Analyse gekürzt`)
  if (platform === 'windows' && databaseEngines.includes('Microsoft SQL Server')) {
    techDebt.push('Windows + MSSQL — für plattformunabhängigen Betrieb: MSSQL → PostgreSQL und UI-Schicht portieren')
  }
  if (languages.some(l => l.name === 'C#') && !databaseEngines.length) {
    techDebt.push('C#-Code ohne eindeutig erkannte DB-Anbindung — Datenzugriff manuell prüfen')
  }

  const appName = appNameFrom(rootPath, files)
  const criticality = assessCriticality(appName, rootPath)

  const partial: Omit<ReverseReport, 'summary'> = {
    rootPath, appName,
    languages, frameworks, platform, platformReasons, databaseEngines, modules, security, securityFindings, techDebt, criticality,
  }
  return { ...partial, summary: buildSummary(partial) }
}
