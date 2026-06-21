/**
 * Repo auto-creation — so a build can create its own target repo instead of the
 * user running `git init` by hand. Local git repo always; optional GitHub repo
 * via the `gh` CLI (best-effort). Idempotent: an existing git repo is reused.
 */
import { execFileSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'

/** Turn a free-text app name into a safe repo/folder slug. */
export function sanitizeRepoName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'app'
}

/** Default base directory for new app repos (~/dev), overridable via env. */
export function defaultReposDir(env: NodeJS.ProcessEnv = process.env): string {
  return env.FORGEPILOT_APPS_DIR?.trim() || path.join(os.homedir(), 'dev')
}

/** Propose an absolute target path for a new app, avoiding collisions with a numeric suffix. */
export function suggestRepoPath(name: string, baseDir: string, exists: (p: string) => boolean = fs.existsSync): string {
  const slug = sanitizeRepoName(name)
  let candidate = path.join(baseDir, slug)
  let n = 2
  while (exists(candidate)) {
    candidate = path.join(baseDir, `${slug}-${n}`)
    n += 1
  }
  return candidate
}

export interface CreateRepoResult {
  path: string
  created: boolean
  reused: boolean
  githubUrl?: string
  detail: string
}

/**
 * Create (or reuse) a local git repo at `targetPath` with a README + .gitignore
 * and an initial commit, so the writeback's ff-merge has a base to fast-forward.
 */
export function createLocalRepo(options: {
  targetPath: string
  appName: string
  gitignore?: string
}): CreateRepoResult {
  const { targetPath, appName } = options
  if (fs.existsSync(path.join(targetPath, '.git'))) {
    return { path: targetPath, created: false, reused: true, detail: 'Bestehendes Repo wiederverwendet' }
  }
  fs.mkdirSync(targetPath, { recursive: true })
  const run = (args: string[]) => execFileSync('git', args, { cwd: targetPath, stdio: 'ignore' })
  run(['init', '-q'])
  // Local identity so the initial commit works on a fresh machine.
  try { execFileSync('git', ['config', 'user.email'], { cwd: targetPath, stdio: 'ignore' }) }
  catch { run(['config', 'user.email', 'forgepilot@local']); run(['config', 'user.name', 'ForgePilot']) }
  if (!fs.existsSync(path.join(targetPath, 'README.md'))) {
    fs.writeFileSync(path.join(targetPath, 'README.md'), `# ${appName}\n\nCreated by ForgePilot.\n`)
  }
  if (!fs.existsSync(path.join(targetPath, '.gitignore'))) {
    fs.writeFileSync(path.join(targetPath, '.gitignore'), options.gitignore ?? 'node_modules/\n.next/\n.env*\n!.env.example\n.claude/\ndist/\n')
  }
  run(['add', '-A'])
  run(['commit', '-q', '-m', `init: ${appName} workspace`])
  return { path: targetPath, created: true, reused: false, detail: `Lokales Repo erstellt: ${targetPath}` }
}

/**
 * Optionally create a GitHub repo and push to it via the `gh` CLI. Best-effort:
 * returns the local result unchanged (with a note) if `gh` is unavailable/unauthed.
 */
export function tryCreateGithubRepo(options: {
  targetPath: string
  name: string
  isPrivate?: boolean
}): { githubUrl?: string; detail: string } {
  const visibility = options.isPrivate === false ? '--public' : '--private'
  try {
    const out = execFileSync('gh', ['repo', 'create', sanitizeRepoName(options.name), visibility, '--source', '.', '--push'], {
      cwd: options.targetPath, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'],
    })
    const url = out.trim().split('\n').find(l => l.startsWith('http'))
    return { githubUrl: url, detail: url ? `GitHub-Repo erstellt: ${url}` : 'GitHub-Repo erstellt' }
  } catch {
    return { detail: 'GitHub übersprungen (gh nicht verfügbar/angemeldet) — lokales Repo genügt' }
  }
}

/** High-level: ensure a target repo exists for a build, creating it if needed. */
export function ensureTargetRepo(options: {
  appName: string
  targetPath?: string
  baseDir?: string
  github?: boolean
}): CreateRepoResult {
  const baseDir = options.baseDir ?? defaultReposDir()
  const targetPath = options.targetPath ?? suggestRepoPath(options.appName, baseDir)
  const local = createLocalRepo({ targetPath, appName: options.appName })
  if (options.github && local.created) {
    const gh = tryCreateGithubRepo({ targetPath, name: options.appName })
    return { ...local, githubUrl: gh.githubUrl, detail: `${local.detail} · ${gh.detail}` }
  }
  return local
}
