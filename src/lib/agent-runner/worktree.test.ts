import { execFileSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getRunnerBaseRef,
  getRunnerWorktreeRoot,
  getTargetRepo,
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

  it('uses HEAD by default and allows a configured runner base ref', () => {
    expect(getRunnerBaseRef({})).toBe('HEAD')
    expect(getRunnerBaseRef({ FORGEPILOT_RUNNER_BASE_REF: 'origin/main' })).toBe('origin/main')
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

  it('creates the runner worktree from the configured base ref', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fp-runner-root-'))
    const source = fs.mkdtempSync(path.join(os.tmpdir(), 'fp-source-'))
    fs.mkdirSync(path.join(source, 'node_modules'))

    try {
      const workspace = prepareRunnerWorkspace({
        delegationId: 'base-ref-run',
        sourceCwd: source,
        env: {
          FORGEPILOT_RUNNER_ROOT: root,
          FORGEPILOT_RUNNER_BASE_REF: 'origin/main',
        },
      })

      expect(execFileSyncMock).toHaveBeenCalledWith(
        'git',
        ['worktree', 'add', '--detach', workspace.path, 'origin/main'],
        expect.objectContaining({ cwd: source, stdio: 'ignore' }),
      )
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

describe('getTargetRepo', () => {
  it('returns undefined when env var is not set', () => {
    expect(getTargetRepo({})).toBeUndefined()
  })

  it('returns undefined when env var is empty string', () => {
    expect(getTargetRepo({ FORGEPILOT_RUNNER_TARGET_REPO: '' })).toBeUndefined()
    expect(getTargetRepo({ FORGEPILOT_RUNNER_TARGET_REPO: '   ' })).toBeUndefined()
  })

  it('returns the configured target repo URL', () => {
    const url = 'https://github.com/owner/repo.git'
    expect(getTargetRepo({ FORGEPILOT_RUNNER_TARGET_REPO: url })).toBe(url)
  })

  it('trims whitespace from the env var value', () => {
    expect(getTargetRepo({ FORGEPILOT_RUNNER_TARGET_REPO: '  https://github.com/owner/repo.git  ' }))
      .toBe('https://github.com/owner/repo.git')
  })
})

describe('prepareRunnerWorkspace — clone mode', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    execFileSyncMock.mockReset()
  })

  it('calls git clone when targetRepo option is provided', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fp-clone-root-'))

    try {
      const workspace = prepareRunnerWorkspace({
        delegationId: 'del-clone-test',
        env: { FORGEPILOT_RUNNER_ROOT: root },
        targetRepo: 'https://github.com/owner/target-repo.git',
      })

      expect(execFileSyncMock).toHaveBeenCalledWith(
        'git',
        ['clone', '--depth', '1', 'https://github.com/owner/target-repo.git', workspace.path],
        expect.objectContaining({ stdio: 'ignore' }),
      )
      expect(workspace.path).toContain('del-clone-test')
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  it('calls git clone when FORGEPILOT_RUNNER_TARGET_REPO env var is set', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fp-clone-env-root-'))

    try {
      prepareRunnerWorkspace({
        delegationId: 'del-env-clone',
        env: {
          FORGEPILOT_RUNNER_ROOT: root,
          FORGEPILOT_RUNNER_TARGET_REPO: 'https://github.com/owner/env-repo.git',
        },
      })

      expect(execFileSyncMock).toHaveBeenCalledWith(
        'git',
        expect.arrayContaining(['clone', '--depth', '1', 'https://github.com/owner/env-repo.git']),
        expect.any(Object),
      )
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  it('option.targetRepo takes precedence over FORGEPILOT_RUNNER_TARGET_REPO env var', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fp-override-root-'))

    try {
      prepareRunnerWorkspace({
        delegationId: 'del-override',
        targetRepo: 'https://github.com/override/repo.git',
        env: {
          FORGEPILOT_RUNNER_ROOT: root,
          FORGEPILOT_RUNNER_TARGET_REPO: 'https://github.com/other/repo.git',
        },
      })

      const cloneCall = execFileSyncMock.mock.calls.find(
        c => c[0] === 'git' && (c[1] as string[]).includes('clone'),
      )
      expect(cloneCall![1]).toContain('https://github.com/override/repo.git')
      expect(cloneCall![1]).not.toContain('https://github.com/other/repo.git')
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  it('clone mode cleanup removes directory with rmSync', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fp-cleanup-root-'))

    try {
      const workspace = prepareRunnerWorkspace({
        delegationId: 'del-cleanup',
        env: { FORGEPILOT_RUNNER_ROOT: root },
        targetRepo: 'https://github.com/owner/repo.git',
      })

      // Create the cloned dir so rmSync has something to remove
      fs.mkdirSync(workspace.path, { recursive: true })
      workspace.cleanup()

      expect(fs.existsSync(workspace.path)).toBe(false)
    } finally {
      if (fs.existsSync(root)) fs.rmSync(root, { recursive: true, force: true })
    }
  })

  it('clone mode cleanup skips deletion when FORGEPILOT_KEEP_RUNNER_WORKTREES=true', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fp-keep-root-'))

    try {
      const workspace = prepareRunnerWorkspace({
        delegationId: 'del-keep-clone',
        env: {
          FORGEPILOT_RUNNER_ROOT: root,
          FORGEPILOT_KEEP_RUNNER_WORKTREES: 'true',
        },
        targetRepo: 'https://github.com/owner/repo.git',
      })

      fs.mkdirSync(workspace.path, { recursive: true })
      workspace.cleanup()
      // Directory should still exist
      expect(fs.existsSync(workspace.path)).toBe(true)
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})
