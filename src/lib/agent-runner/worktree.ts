import { execFileSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'

const DEFAULT_WORKTREE_ROOT = path.join(os.tmpdir(), 'forgepilot-runner-worktrees')

export interface RunnerWorkspace {
  path: string
  cleanup: () => void
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

export function prepareRunnerWorkspace(options: {
  delegationId: string
  sourceCwd?: string
  env?: Record<string, string | undefined>
}): RunnerWorkspace {
  const sourceCwd = options.sourceCwd ?? process.cwd()
  const env = options.env ?? process.env
  const root = getRunnerWorktreeRoot(env)
  const workspacePath = path.join(root, sanitizeWorktreeName(options.delegationId))

  fs.mkdirSync(root, { recursive: true })
  removeExistingWorktree(workspacePath, sourceCwd)

  execFileSync('git', ['worktree', 'add', '--detach', workspacePath, 'HEAD'], {
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
