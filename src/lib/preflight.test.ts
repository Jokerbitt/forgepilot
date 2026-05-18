import { describe, it, expect, vi, beforeEach } from 'vitest'
import { runPreflight } from './preflight'
import type { Delegation } from '@/lib/models/delegation'

vi.mock('child_process', () => ({
  spawnSync: vi.fn(),
}))

import { spawnSync } from 'child_process'
const mockSpawn = vi.mocked(spawnSync)

function ok(out = '') {
  return { stdout: out, stderr: '', status: 0, pid: 1, signal: null, output: [] }
}
function fail(out = '') {
  return { stdout: out, stderr: out, status: 1, pid: 1, signal: null, output: [] }
}

const baseDelegation: Delegation = {
  id: 'del-test',
  title: 'Test Task',
  status: 'approved',
  executionRoute: 'local-agent',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  costEstimateUsd: 1,
  logs: [],
  contract: {
    id: 'contract-test',
    workItemId: 'TEST-1',
    goal: 'Add a simple helper function',
    riskClass: 'A',
    maxBudgetUsd: 2,
    branchStrategy: 'feature',
    taskType: 'feature',
    requiresApproval: false,
    definitionOfDone: ['Function implemented', 'Tests written'],
    context: '',
    allowedTools: [],
    privacyMode: 'local',
    createdAt: '2026-01-01T00:00:00Z',
  },
}

beforeEach(() => { vi.clearAllMocks() })

describe('runPreflight', () => {
  it('passes all checks when environment is healthy', async () => {
    // git, node, gh auth, git status, git branch --list (empty = branch not exists), git branch current
    mockSpawn
      .mockReturnValueOnce(ok('git version 2.40'))   // git --version
      .mockReturnValueOnce(ok('v22.0.0'))             // node --version
      .mockReturnValueOnce(ok('Logged in as user'))   // gh auth status
      .mockReturnValueOnce(ok(''))                    // git status --porcelain (clean)
      .mockReturnValueOnce(ok('main'))                // git branch --show-current
      .mockReturnValueOnce(ok(''))                    // git branch --list (not exists)

    const result = await runPreflight(baseDelegation, 'ghp_test')

    expect(result.canStart).toBe(true)
    expect(result.blockers).toHaveLength(0)
    const gitCheck = result.checks.find(c => c.id === 'git_available')
    expect(gitCheck?.passed).toBe(true)
  })

  it('blocks when git is unavailable', async () => {
    mockSpawn
      .mockReturnValueOnce(fail('git: command not found'))  // git --version
      .mockReturnValueOnce(ok('v22.0.0'))
      .mockReturnValueOnce(ok('Logged in'))
      .mockReturnValueOnce(ok(''))
      .mockReturnValueOnce(ok('main'))
      .mockReturnValueOnce(ok(''))

    const result = await runPreflight(baseDelegation)

    expect(result.canStart).toBe(false)
    expect(result.blockers.some(b => b.id === 'git_available')).toBe(true)
  })

  it('blocks when gh CLI is not authenticated', async () => {
    mockSpawn
      .mockReturnValueOnce(ok('git version 2.40'))
      .mockReturnValueOnce(ok('v22.0.0'))
      .mockReturnValueOnce(fail('not logged in'))     // gh auth status fails
      .mockReturnValueOnce(ok(''))
      .mockReturnValueOnce(ok('main'))
      .mockReturnValueOnce(ok(''))

    const result = await runPreflight(baseDelegation)

    expect(result.canStart).toBe(false)
    expect(result.blockers.some(b => b.id === 'gh_auth')).toBe(true)
  })

  it('warns when task complexity is too high', async () => {
    const complexDelegation: Delegation = {
      ...baseDelegation,
      contract: {
        ...baseDelegation.contract,
        goal: 'Add feature A and also feature B and additionally feature C plus feature D',
        definitionOfDone: ['DoD 1', 'DoD 2', 'DoD 3', 'DoD 4', 'DoD 5', 'DoD 6'],
      },
    }

    mockSpawn
      .mockReturnValueOnce(ok('git version 2.40'))
      .mockReturnValueOnce(ok('v22.0.0'))
      .mockReturnValueOnce(ok('Logged in'))
      .mockReturnValueOnce(ok(''))
      .mockReturnValueOnce(ok('main'))
      .mockReturnValueOnce(ok(''))

    const result = await runPreflight(complexDelegation)

    expect(result.canStart).toBe(true)  // warning only, not blocker
    const complexityCheck = result.checks.find(c => c.id === 'task_complexity')
    expect(complexityCheck?.passed).toBe(false)
    expect(result.warnings.some(w => w.id === 'task_complexity')).toBe(true)
  })

  it('warns when DoD is empty', async () => {
    const noDodDelegation: Delegation = {
      ...baseDelegation,
      contract: { ...baseDelegation.contract, definitionOfDone: [] },
    }

    mockSpawn
      .mockReturnValueOnce(ok('git version 2.40'))
      .mockReturnValueOnce(ok('v22.0.0'))
      .mockReturnValueOnce(ok('Logged in'))
      .mockReturnValueOnce(ok(''))
      .mockReturnValueOnce(ok('main'))
      .mockReturnValueOnce(ok(''))

    const result = await runPreflight(noDodDelegation)

    expect(result.warnings.some(w => w.id === 'dod_not_empty')).toBe(true)
  })
})
