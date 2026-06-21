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

  // Count files in the result tree (outcome signal)
  let fileCount = 0
  try {
    const tree = gitOut(workspacePath, ['ls-tree', '-r', 'HEAD', '--name-only'])
    fileCount = tree ? tree.split('\n').filter(Boolean).length : 0
  } catch { /* keep 0 */ }

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
