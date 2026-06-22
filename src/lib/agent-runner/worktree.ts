import { execFileSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'

const DEFAULT_WORKTREE_ROOT = path.join(os.tmpdir(), 'forgepilot-runner-worktrees')

export interface RunnerWorkspace {
  path: string
  cleanup: () => void
}

export function shouldKeepRunnerWorktree(options: {
  success: boolean
  env?: Record<string, string | undefined>
}): boolean {
  const env = options.env ?? process.env
  if (env.FORGEPILOT_KEEP_RUNNER_WORKTREES === 'true') return true
  if (!options.success && env.FORGEPILOT_KEEP_FAILED_RUNNER_WORKTREES !== 'false') return true
  return false
}

export function sanitizeWorktreeName(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96) || 'runner'
}

export function getRunnerWorktreeRoot(
  env: Record<string, string | undefined> = process.env,
): string {
  const configured = env.FORGEPILOT_RUNNER_ROOT?.trim()
  return configured || DEFAULT_WORKTREE_ROOT
}

export function getRunnerBaseRef(
  env: Record<string, string | undefined> = process.env,
): string {
  return env.FORGEPILOT_RUNNER_BASE_REF?.trim() || 'HEAD'
}

function removeExistingWorktree(workspacePath: string, sourceCwd: string): void {
  if (!fs.existsSync(workspacePath)) return

  try {
    execFileSync('git', ['worktree', 'remove', '--force', workspacePath], {
      cwd: sourceCwd,
      stdio: 'ignore',
    })
    return
  } catch {
    fs.rmSync(workspacePath, { recursive: true, force: true })
  }
}

function linkNodeModules(sourceCwd: string, workspacePath: string): void {
  const source = path.join(sourceCwd, 'node_modules')
  const target = path.join(workspacePath, 'node_modules')
  if (!fs.existsSync(source) || fs.existsSync(target)) return
  fs.symlinkSync(source, target, 'dir')
}

export function getTargetRepo(
  env: Record<string, string | undefined> = process.env,
): string | undefined {
  return env.FORGEPILOT_RUNNER_TARGET_REPO?.trim() || undefined
}

/** True when the target repo is a local filesystem path (not a github.com URL). */
function isLocalPathRepo(targetRepo: string): boolean {
  return targetRepo.startsWith('/') || targetRepo.startsWith('.') || targetRepo.startsWith('~')
}

export interface WritebackResult {
  /** Backup branch the result was pushed to */
  branch: string
  /** Number of files in the result tree (outcome verification — 0/low = suspect) */
  fileCount: number
  /** True when the result was merged into the target repo's main/default branch */
  mergedToMain: boolean
  /** The default branch name we merged into (or attempted) */
  defaultBranch: string
  /** True when npm install ran successfully in the target after merge */
  installed?: boolean
}

function gitOut(cwd: string, args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
}

export type WorkspaceChangeType = 'ADDED' | 'MODIFIED' | 'DELETED' | 'RENAMED'

export interface WorkspaceChangedFile {
  path: string
  changeType: WorkspaceChangeType
}

/** Map a `git diff --name-status` status letter to a change type. */
function mapNameStatus(status: string): WorkspaceChangeType {
  const code = status.trim().charAt(0).toUpperCase()
  if (code === 'A') return 'ADDED'
  if (code === 'D') return 'DELETED'
  if (code === 'R') return 'RENAMED'
  return 'MODIFIED' // M, C, T, U, … → treat as modified
}

/** Parse the porcelain output of `git diff --name-status` into change entries. */
export function parseNameStatus(output: string): WorkspaceChangedFile[] {
  return output
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      // Format: "<status>\t<path>" — for renames: "R100\t<old>\t<new>".
      const parts = line.split('\t')
      const status = parts[0]
      const path = parts.length > 2 ? parts[parts.length - 1] : parts[1]
      if (!path) return null
      return { path, changeType: mapNameStatus(status) }
    })
    .filter((entry): entry is WorkspaceChangedFile => entry !== null)
}

/**
 * Resolve the base ref the agent's commits sit on top of, so a diff against it
 * yields exactly the files the run changed.
 *
 * - Clone mode (external / local target): the depth-1 clone tracks an upstream,
 *   so `@{upstream}` is the original tip the agent built upon.
 * - Worktree mode (ForgePilot's own repo, detached HEAD): no upstream — fall
 *   back to the reflog parent `HEAD@{1}` (the commit the worktree started at).
 * Returns null when no base can be resolved (e.g. no commits yet).
 */
function resolveDiffBase(workspacePath: string): string | null {
  for (const candidate of ['@{upstream}', 'HEAD@{1}']) {
    try {
      gitOut(workspacePath, ['rev-parse', '--verify', '--quiet', candidate])
      return candidate
    } catch {
      // try next candidate
    }
  }
  return null
}

/**
 * Compute the files an agent changed in its workspace, independent of whether a
 * PR was opened. Used to fill the summary report for LOCAL targets (no PR → no
 * gh-based file list). Best-effort: returns [] when git is unavailable, the
 * workspace is missing, or no base ref can be resolved. Never throws.
 */
export function getWorkspaceChangedFiles(workspacePath: string): WorkspaceChangedFile[] {
  if (!workspacePath || !fs.existsSync(workspacePath)) return []
  try {
    const base = resolveDiffBase(workspacePath)
    if (!base) return []
    const output = gitOut(workspacePath, ['diff', '--name-status', `${base}`, 'HEAD'])
    return parseNameStatus(output)
  } catch {
    return []
  }
}

/**
 * Decide whether to run `npm install` in the target after a writeback merge.
 * Pure + unit-tested. Installs when there is a package.json AND either deps are
 * missing OR the merge changed package.json (a feature added a new dependency —
 * the gap that left pdf-lib uninstalled and broke the build).
 */
export function shouldRunInstall(opts: {
  hasPackageJson: boolean
  hasNodeModules: boolean
  packageJsonChanged: boolean
}): boolean {
  if (!opts.hasPackageJson) return false
  return !opts.hasNodeModules || opts.packageJsonChanged
}

/**
 * Write the agent's result back to a LOCAL target repo before the temp clone is deleted.
 *
 * Clone-mode work is otherwise lost: the agent commits to a temp clone that
 * cleanup() then deletes, and a local repo has no GitHub remote for a PR.
 *
 * Strategy (in order):
 *  1. Push the clone's HEAD to a `forgepilot/result-<id>` backup branch (always works).
 *  2. Fast-forward the target repo's default branch to that result via fetch+merge.
 *     A fresh depth-1 clone makes the agent's commits direct descendants of the
 *     target's default branch, so an ff-merge succeeds and updates the working tree
 *     in place — the app appears in the target repo, fully autonomous.
 *
 * Returns file count + whether the main merge succeeded, for outcome verification.
 */
export function writebackLocalResult(options: {
  workspacePath: string
  targetRepo: string
  delegationId: string
}): WritebackResult | null {
  const { workspacePath, targetRepo, delegationId } = options
  if (!isLocalPathRepo(targetRepo)) return null
  if (!fs.existsSync(workspacePath) || !fs.existsSync(targetRepo)) return null

  const branch = `forgepilot/result-${sanitizeWorktreeName(delegationId).slice(0, 16)}`

  // 1. Push backup branch (always allowed — it's a new ref)
  try {
    execFileSync('git', ['push', 'origin', `HEAD:refs/heads/${branch}`, '--force'], {
      cwd: workspacePath, stdio: 'ignore',
    })
  } catch {
    return null
  }

  // Count the files the agent actually CHANGED (the real diff). Using the whole
  // result tree (git ls-tree) counted every tracked file — including tracked
  // node_modules in some repos — and wildly overstated the blast radius
  // ("859 Dateien" for a 3-file change). getWorkspaceChangedFiles is best-effort
  // (returns [] on failure) and matches the summaryReport's file list.
  const fileCount = getWorkspaceChangedFiles(workspacePath).length

  // 2. Try to fast-forward the target's default branch in place
  let defaultBranch = 'main'
  let mergedToMain = false
  let packageJsonChanged = false
  try {
    defaultBranch = gitOut(targetRepo, ['rev-parse', '--abbrev-ref', 'HEAD']) || 'main'
    const beforeSha = gitOut(targetRepo, ['rev-parse', 'HEAD'])
    // Fetch the clone's commits into the target repo without touching its working tree
    execFileSync('git', ['fetch', workspacePath, 'HEAD'], { cwd: targetRepo, stdio: 'ignore' })
    // Fast-forward only — safe: never rewrites history, fails cleanly if not a descendant
    execFileSync('git', ['merge', '--ff-only', 'FETCH_HEAD'], { cwd: targetRepo, stdio: 'ignore' })
    mergedToMain = true
    // Did the merge touch package.json? (a feature adding a new dependency)
    try {
      const changed = gitOut(targetRepo, ['diff', '--name-only', `${beforeSha}..HEAD`])
      packageJsonChanged = changed.split('\n').some(f => f === 'package.json' || f.endsWith('/package.json'))
    } catch { /* keep false */ }
  } catch {
    // ff-merge not possible (target default branch diverged) — backup branch still has the work
    mergedToMain = false
  }

  // 3. Auto-install deps in the target so the app is immediately runnable.
  // node_modules is (correctly) gitignored and never travels; AND a feature may
  // have added a new dependency to package.json that isn't installed yet.
  let installed = false
  const doInstall = mergedToMain && shouldRunInstall({
    hasPackageJson: fs.existsSync(path.join(targetRepo, 'package.json')),
    hasNodeModules: fs.existsSync(path.join(targetRepo, 'node_modules')),
    packageJsonChanged,
  })
  if (doInstall) {
    try {
      execFileSync('npm', ['install'], { cwd: targetRepo, stdio: 'ignore', timeout: 180_000 })
      installed = true
    } catch { /* install best-effort — user can run it manually */ }
  }

  return { branch, fileCount, mergedToMain, defaultBranch, installed }
}

/**
 * Wrap an EXISTING workspace path as a RunnerWorkspace so a later chain phase
 * can keep building on the previous phase's work (persistent multi-phase build).
 * Returns null when the path is missing or not a git repo.
 */
export function reuseExistingWorkspace(
  workspacePath: string,
  env: Record<string, string | undefined> = process.env,
): RunnerWorkspace | null {
  if (!workspacePath || !fs.existsSync(workspacePath)) return null
  if (!fs.existsSync(path.join(workspacePath, '.git'))) return null
  return {
    path: workspacePath,
    cleanup: () => {
      if (env.FORGEPILOT_KEEP_RUNNER_WORKTREES === 'true') return
      fs.rmSync(workspacePath, { recursive: true, force: true })
    },
  }
}

export function prepareRunnerWorkspace(options: {
  delegationId: string
  sourceCwd?: string
  env?: Record<string, string | undefined>
  /** Override target repo URL (takes precedence over env var) */
  targetRepo?: string
  /** If provided, skip workspace creation and reuse this existing workspace (M107 retry) */
  existingWorkspace?: RunnerWorkspace
}): RunnerWorkspace {
  if (options.existingWorkspace) return options.existingWorkspace
  const sourceCwd = options.sourceCwd ?? process.cwd()
  const env = options.env ?? process.env
  const root = getRunnerWorktreeRoot(env)
  const workspacePath = path.join(root, sanitizeWorktreeName(options.delegationId))
  const targetRepo = options.targetRepo ?? getTargetRepo(env)

  fs.mkdirSync(root, { recursive: true })

  if (targetRepo) {
    // Clone mode: agent works against an external repository
    if (fs.existsSync(workspacePath)) {
      fs.rmSync(workspacePath, { recursive: true, force: true })
    }
    execFileSync('git', ['clone', '--depth', '1', targetRepo, workspacePath], {
      stdio: 'ignore',
    })

    // A fresh clone has no node_modules (gitignored). For a LOCAL target, symlink
    // its already-installed deps into the workspace so the agent can build/test
    // immediately — otherwise `npm run build`/`test` fail on the missing deps and
    // the run is wasted. (Remote URLs have no local deps to link; there the agent
    // must run `npm install` itself.)
    if (isLocalPathRepo(targetRepo)) {
      linkNodeModules(targetRepo, workspacePath)
    }

    return {
      path: workspacePath,
      cleanup: () => {
        if (env.FORGEPILOT_KEEP_RUNNER_WORKTREES === 'true') return
        fs.rmSync(workspacePath, { recursive: true, force: true })
      },
    }
  }

  // Worktree mode: agent works against ForgePilot's own repo
  const baseRef = getRunnerBaseRef(env)
  removeExistingWorktree(workspacePath, sourceCwd)

  execFileSync('git', ['worktree', 'add', '--detach', workspacePath, baseRef], {
    cwd: sourceCwd,
    stdio: 'ignore',
  })
  if (!fs.existsSync(workspacePath)) fs.mkdirSync(workspacePath, { recursive: true })

  linkNodeModules(sourceCwd, workspacePath)

  return {
    path: workspacePath,
    cleanup: () => {
      if (env.FORGEPILOT_KEEP_RUNNER_WORKTREES === 'true') return
      removeExistingWorktree(workspacePath, sourceCwd)
    },
  }
}
