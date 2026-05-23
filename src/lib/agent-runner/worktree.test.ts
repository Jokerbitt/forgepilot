import { execFileSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getRunnerWorktreeRoot,
  prepareRunnerWorkspace,
  sanitizeWorktreeName,
  shouldKeepRunnerWorktree,
} from './worktree'

vi.mock('child_process', () => ({
  execFileSync: vi.fn(),
}))

const execFileSyncMock = vi.mocked(execFileSync)

describe('runner worktree helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    execFileSyncMock.mockReset()
  })

  it('sanitizes delegation ids for filesystem-safe worktree names', () => {
    expect(sanitizeWorktreeName('M3 Real Loop: fix/app warning!')).toBe('M3-Real-Loop-fix-app-warning')
    expect(sanitizeWorktreeName('///')).toBe('runner')
  })

  it('uses a configurable root outside the app worktree', () => {
    expect(getRunnerWorktreeRoot({ FORGEPILOT_RUNNER_ROOT: '/tmp/custom-runs' })).toBe('/tmp/custom-runs')
    expect(getRunnerWorktreeRoot({})).toBe(path.join(os.tmpdir(), 'forgepilot-runner-worktrees'))
  })

  it('creates a detached git worktree and links node_modules when available', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fp-runner-root-'))
    const source = fs.mkdtempSync(path.join(os.tmpdir(), 'fp-source-'))
    fs.mkdirSync(path.join(source, 'node_modules'))

    try {
      const workspace = prepareRunnerWorkspace({
        delegationId: 'del 123',
        sourceCwd: source,
        env: { FORGEPILOT_RUNNER_ROOT: root },
      })

      expect(workspace.path).toBe(path.join(root, 'del-123'))
      expect(execFileSyncMock).toHaveBeenCalledWith(
        'git',
        ['worktree', 'add', '--detach', workspace.path, 'HEAD'],
        expect.objectContaining({ cwd: source, stdio: 'ignore' }),
      )
      expect(fs.lstatSync(path.join(workspace.path, 'node_modules')).isSymbolicLink()).toBe(true)
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
      fs.rmSync(source, { recursive: true, force: true })
    }
  })

  it('keeps runner worktrees when the debug env flag is enabled', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fp-runner-root-'))
    const source = fs.mkdtempSync(path.join(os.tmpdir(), 'fp-source-'))

    try {
      const workspace = prepareRunnerWorkspace({
        delegationId: 'debug-run',
        sourceCwd: source,
        env: {
          FORGEPILOT_RUNNER_ROOT: root,
          FORGEPILOT_KEEP_RUNNER_WORKTREES: 'true',
        },
      })

      execFileSyncMock.mockClear()
      workspace.cleanup()
      expect(execFileSyncMock).not.toHaveBeenCalled()
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
      fs.rmSync(source, { recursive: true, force: true })
    }
  })

  it('keeps failed runner worktrees by default so partial work can be recovered', () => {
    expect(shouldKeepRunnerWorktree({ success: false, env: {} })).toBe(true)
    expect(shouldKeepRunnerWorktree({
      success: false,
      env: { FORGEPILOT_KEEP_FAILED_RUNNER_WORKTREES: 'false' },
    })).toBe(false)
    expect(shouldKeepRunnerWorktree({ success: true, env: {} })).toBe(false)
  })
})
