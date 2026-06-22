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
  writebackLocalResult,
  reuseExistingWorkspace,
  shouldRunInstall,
  parseNameStatus,
  getWorkspaceChangedFiles,
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

describe('shouldRunInstall', () => {
  it('skips when there is no package.json', () => {
    expect(shouldRunInstall({ hasPackageJson: false, hasNodeModules: false, packageJsonChanged: true })).toBe(false)
  })
  it('installs when node_modules is missing', () => {
    expect(shouldRunInstall({ hasPackageJson: true, hasNodeModules: false, packageJsonChanged: false })).toBe(true)
  })
  it('installs when package.json changed even if node_modules exists (new dependency)', () => {
    expect(shouldRunInstall({ hasPackageJson: true, hasNodeModules: true, packageJsonChanged: true })).toBe(true)
  })
  it('skips when deps exist and package.json did not change', () => {
    expect(shouldRunInstall({ hasPackageJson: true, hasNodeModules: true, packageJsonChanged: false })).toBe(false)
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

  it('symlinks node_modules from a LOCAL target after clone so the agent can build', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fp-clone-local-root-'))
    const target = fs.mkdtempSync(path.join(os.tmpdir(), 'fp-clone-local-target-'))
    fs.mkdirSync(path.join(target, 'node_modules'))
    const workspacePath = path.join(root, sanitizeWorktreeName('del-local-clone'))
    // Mocked git clone is a no-op — simulate it creating the workspace directory.
    execFileSyncMock.mockImplementation(((_cmd: unknown, args: unknown) => {
      if (Array.isArray(args) && args.includes('clone')) {
        fs.mkdirSync(workspacePath, { recursive: true })
      }
      return Buffer.from('')
    }) as typeof execFileSync)

    try {
      const workspace = prepareRunnerWorkspace({
        delegationId: 'del-local-clone',
        env: { FORGEPILOT_RUNNER_ROOT: root },
        targetRepo: target,
      })

      expect(fs.existsSync(path.join(workspace.path, 'node_modules'))).toBe(true)
      expect(fs.lstatSync(path.join(workspace.path, 'node_modules')).isSymbolicLink()).toBe(true)
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
      fs.rmSync(target, { recursive: true, force: true })
    }
  })

  it('does NOT symlink node_modules for a remote URL target (no local deps to link)', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fp-clone-remote-root-'))
    const workspacePath = path.join(root, sanitizeWorktreeName('del-remote-clone'))
    execFileSyncMock.mockImplementation(((_cmd: unknown, args: unknown) => {
      if (Array.isArray(args) && args.includes('clone')) {
        fs.mkdirSync(workspacePath, { recursive: true })
      }
      return Buffer.from('')
    }) as typeof execFileSync)

    try {
      const workspace = prepareRunnerWorkspace({
        delegationId: 'del-remote-clone',
        env: { FORGEPILOT_RUNNER_ROOT: root },
        targetRepo: 'https://github.com/owner/target-repo.git',
      })
      expect(fs.existsSync(path.join(workspace.path, 'node_modules'))).toBe(false)
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

describe('writebackLocalResult', () => {
  afterEach(() => { execFileSyncMock.mockReset() })

  it('returns null for github.com URLs (not a local path)', () => {
    const result = writebackLocalResult({
      workspacePath: '/tmp/ws',
      targetRepo: 'https://github.com/foo/bar',
      delegationId: 'del-1',
    })
    expect(result).toBeNull()
    expect(execFileSyncMock).not.toHaveBeenCalled()
  })

  it('returns null when workspace path does not exist', () => {
    const result = writebackLocalResult({
      workspacePath: '/tmp/definitely-does-not-exist-xyz-123',
      targetRepo: '/tmp',
      delegationId: 'del-2',
    })
    expect(result).toBeNull()
  })

  it('pushes a result branch and reports outcome fields', () => {
    execFileSyncMock.mockReturnValue('' as never)
    const result = writebackLocalResult({
      workspacePath: '/tmp',          // exists
      targetRepo: '/tmp',             // exists + local path
      delegationId: 'del-abc123-xyz',
    })
    expect(result).not.toBeNull()
    expect(result?.branch).toContain('forgepilot/result-')
    expect(typeof result?.fileCount).toBe('number')
    expect(typeof result?.mergedToMain).toBe('boolean')
    // the FIRST git call must be the backup-branch push
    const push = execFileSyncMock.mock.calls.find(c => Array.isArray(c[1]) && c[1].includes('push'))
    expect(push?.[1]).toContain('origin')
  })

  it('returns null when the backup-branch push fails', () => {
    execFileSyncMock.mockImplementationOnce(() => { throw new Error('push rejected') })
    const result = writebackLocalResult({
      workspacePath: '/tmp',
      targetRepo: '/tmp',
      delegationId: 'del-pushfail',
    })
    expect(result).toBeNull()
  })

})

describe('reuseExistingWorkspace', () => {
  it('returns null for a non-existent path', () => {
    expect(reuseExistingWorkspace('/tmp/does-not-exist-xyz-123')).toBeNull()
  })

  it('returns null when path exists but is not a git repo', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fp-reuse-nogit-'))
    try {
      expect(reuseExistingWorkspace(dir)).toBeNull()
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  it('reuses a directory that contains a .git folder', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fp-reuse-git-'))
    try {
      fs.mkdirSync(path.join(dir, '.git'))
      const ws = reuseExistingWorkspace(dir)
      expect(ws).not.toBeNull()
      expect(ws?.path).toBe(dir)
      expect(typeof ws?.cleanup).toBe('function')
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('parseNameStatus', () => {
  it('maps status letters to change types', () => {
    const out = 'A\tsrc/new.ts\nM\tsrc/app.ts\nD\tsrc/old.ts'
    expect(parseNameStatus(out)).toEqual([
      { path: 'src/new.ts', changeType: 'ADDED' },
      { path: 'src/app.ts', changeType: 'MODIFIED' },
      { path: 'src/old.ts', changeType: 'DELETED' },
    ])
  })

  it('treats copies/type-changes as modified', () => {
    expect(parseNameStatus('C\ta.ts\nT\tb.ts')).toEqual([
      { path: 'a.ts', changeType: 'MODIFIED' },
      { path: 'b.ts', changeType: 'MODIFIED' },
    ])
  })

  it('uses the new path for renames (status with score)', () => {
    // git rename rows: "R100\t<old>\t<new>"
    expect(parseNameStatus('R100\told/name.ts\tnew/name.ts')).toEqual([
      { path: 'new/name.ts', changeType: 'RENAMED' },
    ])
  })

  it('ignores blank lines and trims whitespace', () => {
    expect(parseNameStatus('\n  \nA\tonly.ts\n')).toEqual([
      { path: 'only.ts', changeType: 'ADDED' },
    ])
  })

  it('returns [] for empty output', () => {
    expect(parseNameStatus('')).toEqual([])
  })
})

describe('getWorkspaceChangedFiles', () => {
  it('returns [] for a non-existent workspace', () => {
    expect(getWorkspaceChangedFiles('/tmp/does-not-exist-wcf-123')).toEqual([])
  })

  it('returns [] when no base ref resolves (rev-parse fails for all candidates)', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fp-wcf-nobase-'))
    try {
      execFileSyncMock.mockImplementation(() => {
        throw new Error('unknown revision')
      })
      expect(getWorkspaceChangedFiles(dir)).toEqual([])
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  it('diffs against the resolved base and parses the changed files', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fp-wcf-ok-'))
    try {
      execFileSyncMock.mockReset()
      execFileSyncMock.mockImplementation((_cmd, args) => {
        const argv = args as string[]
        // First resolvable candidate is @{upstream} (rev-parse succeeds).
        // gitOut() calls .trim() on the result, so return strings (encoding: utf-8).
        if (argv[0] === 'rev-parse') return 'deadbeef\n'
        if (argv[0] === 'diff') return 'A\tsrc/feature.ts\nM\tREADME.md\n'
        return ''
      })
      expect(getWorkspaceChangedFiles(dir)).toEqual([
        { path: 'src/feature.ts', changeType: 'ADDED' },
        { path: 'README.md', changeType: 'MODIFIED' },
      ])
      // base resolution used @{upstream} (the clone-mode base)
      const diffCall = execFileSyncMock.mock.calls.find(c => (c[1] as string[])[0] === 'diff')
      expect(diffCall?.[1]).toEqual(['diff', '--name-status', '@{upstream}', 'HEAD'])
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  it('falls back to HEAD@{1} when @{upstream} does not resolve', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fp-wcf-fallback-'))
    try {
      execFileSyncMock.mockReset()
      execFileSyncMock.mockImplementation((_cmd, args) => {
        const argv = args as string[]
        if (argv[0] === 'rev-parse') {
          if (argv.includes('@{upstream}')) throw new Error('no upstream')
          return 'cafef00d\n' // HEAD@{1} resolves
        }
        if (argv[0] === 'diff') return 'A\tonly.ts\n'
        return ''
      })
      expect(getWorkspaceChangedFiles(dir)).toEqual([
        { path: 'only.ts', changeType: 'ADDED' },
      ])
      const diffCall = execFileSyncMock.mock.calls.find(c => (c[1] as string[])[0] === 'diff')
      expect(diffCall?.[1]).toEqual(['diff', '--name-status', 'HEAD@{1}', 'HEAD'])
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
})
