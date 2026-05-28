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
