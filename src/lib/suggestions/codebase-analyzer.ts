/**
 * Codebase Analyzer — scans an EXISTING app's repo to produce a compact,
 * factual summary that grounds context-aware improvement suggestions.
 *
 * It is deliberately read-only and fast: it inspects package.json, the
 * directory shape, framework markers, test/CI presence and a few risk signals
 * (missing tests, no TypeScript, no lockfile, lots of TODOs). The result is
 * both a structured object (for the UI / tests) and a plain-text block that
 * gets fed to the LLM as grounding context.
 *
 * Reuses readProjectConfig from the delegation codebase-scout so we share the
 * exact same notion of "project conventions" the agents already rely on.
 */
import { execFileSync } from 'child_process'
import { existsSync, readFileSync, statSync } from 'fs'
import { join } from 'path'
import { readProjectConfig } from '@/lib/delegations/codebase-scout'

export interface CodebaseAnalysis {
  /** Absolute repo path that was analyzed. */
  repoPath: string
  /** Best-effort app name (from package.json or folder name). */
  appName: string
  /** Detected language(s) / framework(s), e.g. "TypeScript", "Next.js". */
  stack: string[]
  /** Notable production dependencies (capped). */
  dependencies: string[]
  /** Top-level source directories that exist. */
  sourceDirs: string[]
  /** Whether a test setup is present (test script or test files). */
  hasTests: boolean
  /** Whether TypeScript is in use. */
  hasTypeScript: boolean
  /** Whether a CI workflow is present. */
  hasCI: boolean
  /** Whether a README exists. */
  hasReadme: boolean
  /** Heuristic risk/opportunity signals worth improving. */
  signals: string[]
}

const KNOWN_FRAMEWORKS: Array<{ dep: string; label: string }> = [
  { dep: 'next', label: 'Next.js' },
  { dep: 'react', label: 'React' },
  { dep: 'vue', label: 'Vue' },
  { dep: 'svelte', label: 'Svelte' },
  { dep: '@angular/core', label: 'Angular' },
  { dep: 'express', label: 'Express' },
  { dep: 'fastify', label: 'Fastify' },
  { dep: 'nestjs', label: 'NestJS' },
  { dep: '@nestjs/core', label: 'NestJS' },
  { dep: 'tailwindcss', label: 'Tailwind CSS' },
  { dep: 'prisma', label: 'Prisma' },
  { dep: '@prisma/client', label: 'Prisma' },
  { dep: 'vitest', label: 'Vitest' },
  { dep: 'jest', label: 'Jest' },
]

const CANDIDATE_SOURCE_DIRS = ['src', 'app', 'lib', 'pages', 'components', 'server', 'api']

interface PackageJson {
  name?: string
  scripts?: Record<string, string>
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

function readPackageJson(repoPath: string): PackageJson | null {
  const pkgPath = join(repoPath, 'package.json')
  if (!existsSync(pkgPath)) return null
  try {
    return JSON.parse(readFileSync(pkgPath, 'utf8')) as PackageJson
  } catch {
    return null
  }
}

/** Count files matching an extension under src/ — used as a TODO/test heuristic. */
function grepCount(repoPath: string, pattern: string): number {
  const searchDirs = CANDIDATE_SOURCE_DIRS.map(d => join(repoPath, d)).filter(existsSync)
  if (searchDirs.length === 0) return 0
  try {
    const out = execFileSync(
      'grep',
      ['-rIl', '--include=*.ts', '--include=*.tsx', '--include=*.js', '--include=*.jsx', '-E', pattern, ...searchDirs],
      { cwd: repoPath, encoding: 'utf8', timeout: 5000, maxBuffer: 1024 * 1024 },
    ).trim()
    return out ? out.split('\n').filter(Boolean).length : 0
  } catch {
    // grep exit 1 = no match
    return 0
  }
}

/**
 * Analyze an existing app repo. Pure I/O — never throws on a bad path; returns
 * a best-effort analysis with whatever could be read.
 */
export function analyzeCodebase(repoPath: string): CodebaseAnalysis {
  const exists = existsSync(repoPath) && (() => { try { return statSync(repoPath).isDirectory() } catch { return false } })()
  const pkg = exists ? readPackageJson(repoPath) : null
  const config = exists ? readProjectConfig(repoPath) : {}

  const folderName = repoPath.split('/').filter(Boolean).pop() ?? 'app'
  const appName = pkg?.name?.trim() || folderName

  const allDeps = { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) }
  const depNames = Object.keys(allDeps)

  const stack: string[] = []
  const hasTypeScript = exists && (existsSync(join(repoPath, 'tsconfig.json')) || depNames.includes('typescript'))
  if (hasTypeScript) stack.push('TypeScript')
  else if (depNames.length > 0 || existsSync(join(repoPath, 'package.json'))) stack.push('JavaScript')
  for (const fw of KNOWN_FRAMEWORKS) {
    if (depNames.includes(fw.dep) && !stack.includes(fw.label)) stack.push(fw.label)
  }

  // Notable production deps (skip the frameworks we already named), capped.
  const namedFrameworkDeps = new Set(KNOWN_FRAMEWORKS.map(f => f.dep))
  const dependencies = Object.keys(pkg?.dependencies ?? {})
    .filter(d => !namedFrameworkDeps.has(d))
    .slice(0, 12)

  const sourceDirs = exists ? CANDIDATE_SOURCE_DIRS.filter(d => existsSync(join(repoPath, d))) : []

  const scripts = pkg?.scripts ?? {}
  const hasTestScript = Boolean(scripts['test'] || scripts['test:run'])
  const testFileCount = exists ? grepCount(repoPath, '\\.(test|spec)\\.') : 0
  const hasTests = hasTestScript || testFileCount > 0

  const hasCI = exists && (existsSync(join(repoPath, '.github', 'workflows')) || existsSync(join(repoPath, '.gitlab-ci.yml')))
  const hasReadme = exists && (existsSync(join(repoPath, 'README.md')) || existsSync(join(repoPath, 'readme.md')))

  const signals: string[] = []
  if (!exists) signals.push('Repo path not found or not a directory — analysis is empty')
  if (exists && !pkg) signals.push('No package.json — non-Node project or missing manifest')
  if (exists && pkg && !hasTypeScript) signals.push('No TypeScript — type-safety could be added')
  if (exists && pkg && !hasTests) signals.push('No tests detected — test coverage is a high-value improvement')
  if (exists && pkg && !hasCI) signals.push('No CI workflow — automated checks could be added')
  if (exists && pkg && !hasReadme) signals.push('No README — onboarding/documentation gap')
  if (exists && !existsSync(join(repoPath, 'package-lock.json')) && !existsSync(join(repoPath, 'pnpm-lock.yaml')) && !existsSync(join(repoPath, 'yarn.lock')) && pkg) {
    signals.push('No lockfile — reproducible installs at risk')
  }
  const todoCount = exists ? grepCount(repoPath, 'TODO|FIXME|HACK') : 0
  if (todoCount >= 3) signals.push(`${todoCount} files contain TODO/FIXME/HACK markers — unfinished work`)
  if (config.claudeMd || config.agentsMd) signals.push('Has agent conventions (CLAUDE.md/AGENTS.md) — respect them')

  return {
    repoPath,
    appName,
    stack,
    dependencies,
    sourceDirs,
    hasTests,
    hasTypeScript,
    hasCI,
    hasReadme,
    signals,
  }
}

/**
 * Render an analysis as a compact plain-text block for LLM grounding.
 * Kept terse so it fits comfortably inside the suggestion prompt.
 */
export function analysisToContext(analysis: CodebaseAnalysis): string {
  const lines: string[] = [
    `App: ${analysis.appName}`,
    `Stack: ${analysis.stack.length ? analysis.stack.join(', ') : 'unknown'}`,
  ]
  if (analysis.dependencies.length) lines.push(`Key dependencies: ${analysis.dependencies.join(', ')}`)
  if (analysis.sourceDirs.length) lines.push(`Source dirs: ${analysis.sourceDirs.join(', ')}`)
  lines.push(`Tests: ${analysis.hasTests ? 'yes' : 'no'} | TypeScript: ${analysis.hasTypeScript ? 'yes' : 'no'} | CI: ${analysis.hasCI ? 'yes' : 'no'} | README: ${analysis.hasReadme ? 'yes' : 'no'}`)
  if (analysis.signals.length) lines.push(`Signals:\n- ${analysis.signals.join('\n- ')}`)
  return lines.join('\n')
}
