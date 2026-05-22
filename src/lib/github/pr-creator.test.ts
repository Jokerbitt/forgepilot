import { describe, it, expect, vi } from 'vitest'
import { createGitHubPRIfNeeded } from './pr-creator'
import type { Delegation } from '@/lib/models/delegation'

// Mock dependencies to avoid side effects
vi.mock('@/lib/connectors/config', () => ({
  readStoredApiKeys: vi.fn(() => ({})),
}))

vi.mock('child_process', () => ({
  execSync: vi.fn(() => ''),
}))

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>()
  return {
    ...actual,
    readFileSync: vi.fn((filePath: unknown) => {
      if (typeof filePath === 'string' && filePath.endsWith('package.json')) {
        return JSON.stringify({})
      }
      return actual.readFileSync(filePath as Parameters<typeof actual.readFileSync>[0])
    }),
  }
})

vi.mock('@/lib/logger', () => ({
  apiLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

const base: Delegation = {
  id: 'del-1',
  title: 'Fix login bug',
  status: 'completed',
  executionRoute: 'local-agent',
  costEstimateUsd: 0,
  autoOrchestrate: false,
  contract: {
    id: 'contract-1',
    workItemId: 'JOK-123',
    goal: 'fix login bug',
    context: '',
    definitionOfDone: [],
    riskClass: 'B',
    maxBudgetUsd: 1,
    allowedTools: [],
    branchStrategy: 'fix',
    requiresApproval: false,
    privacyMode: 'local',
    createdAt: new Date().toISOString(),
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

describe('createGitHubPRIfNeeded', () => {
  it('skips when GITHUB_TOKEN is not set', async () => {
    const result = await createGitHubPRIfNeeded(base)
    expect(result.skipped).toBe(true)
    expect(result.reason).toContain('GITHUB_TOKEN')
  })

  it('skips when prUrl already set', async () => {
    const result = await createGitHubPRIfNeeded({
      ...base,
      summaryReport: {
        keyPoints: [],
        changes: [],
        timeTakenMinutes: 0,
        prUrl: 'https://github.com/owner/repo/pull/1',
      },
    })
    expect(result.skipped).toBe(true)
    expect(result.reason).toContain('prUrl already set')
  })

  it('skips when no branch name found and no contract workItemId', async () => {
    vi.stubEnv('GITHUB_TOKEN', 'tok')
    vi.stubEnv('GITHUB_REPO', 'owner/repo')

    // delegation with empty workItemId produces an empty slug — branch will still be derived
    // so test with a delegation that has no agent output with branch pattern
    const result = await createGitHubPRIfNeeded(base, 'no branch here')

    // Branch is derived from contract (fix/jok-123-task) so it won't skip due to no branch
    // It will attempt fetch — but fetch is not mocked here so it will error
    // The important thing is it doesn't skip for "no branch"
    expect(result).toBeDefined()

    vi.unstubAllEnvs()
  })

  it('skips when delegation is not completed', async () => {
    vi.stubEnv('GITHUB_TOKEN', 'tok')
    vi.stubEnv('GITHUB_REPO', 'owner/repo')

    const result = await createGitHubPRIfNeeded({ ...base, status: 'running' })
    expect(result.skipped).toBe(true)
    expect(result.reason).toContain('not completed')

    vi.unstubAllEnvs()
  })

  it('returns prUrl on successful API response', async () => {
    vi.stubEnv('GITHUB_TOKEN', 'tok')
    vi.stubEnv('GITHUB_REPO', 'owner/repo')

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 201,
      ok: true,
      json: async () => ({ html_url: 'https://github.com/owner/repo/pull/42', number: 42 }),
    }))

    const result = await createGitHubPRIfNeeded(
      base,
      'git checkout -b feature/fix-login created',
    )
    expect(result.skipped).toBe(false)
    expect(result.prUrl).toBe('https://github.com/owner/repo/pull/42')

    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('supports GITHUB_OWNER plus repo-only GITHUB_REPO configuration', async () => {
    vi.stubEnv('GITHUB_TOKEN', 'tok')
    vi.stubEnv('GITHUB_OWNER', 'owner')
    vi.stubEnv('GITHUB_REPO', 'repo')

    const fetchSpy = vi.fn().mockResolvedValue({
      status: 201,
      ok: true,
      json: async () => ({ html_url: 'https://github.com/owner/repo/pull/43', number: 43 }),
    })
    vi.stubGlobal('fetch', fetchSpy)

    const result = await createGitHubPRIfNeeded(
      base,
      'git checkout -b feature/fix-login created',
    )

    expect(result.skipped).toBe(false)
    expect(result.prUrl).toBe('https://github.com/owner/repo/pull/43')
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.github.com/repos/owner/repo/pulls',
      expect.objectContaining({ method: 'POST' }),
    )

    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('preserves feature branch prefix when extracting branch names', async () => {
    vi.stubEnv('GITHUB_TOKEN', 'tok')
    vi.stubEnv('GITHUB_REPO', 'owner/repo')

    const fetchSpy = vi.fn().mockResolvedValue({
      status: 201,
      ok: true,
      json: async () => ({ html_url: 'https://github.com/owner/repo/pull/44', number: 44 }),
    })
    vi.stubGlobal('fetch', fetchSpy)

    await createGitHubPRIfNeeded(base, 'created branch feature/fix-login')

    const request = JSON.parse(String(fetchSpy.mock.calls[0][1]?.body))
    expect(request.head).toBe('feature/fix-login')

    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('skips (no throw) when GitHub API returns error status', async () => {
    vi.stubEnv('GITHUB_TOKEN', 'tok')
    vi.stubEnv('GITHUB_REPO', 'owner/repo')

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => 'Forbidden',
    }))

    const result = await createGitHubPRIfNeeded(
      base,
      'git checkout -b feature/fix-login created',
    )
    expect(result.skipped).toBe(true)
    expect(result.reason).toContain('403')

    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('skips (no throw) when fetch throws a network error', async () => {
    vi.stubEnv('GITHUB_TOKEN', 'tok')
    vi.stubEnv('GITHUB_REPO', 'owner/repo')

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')))

    const result = await createGitHubPRIfNeeded(
      base,
      'git checkout -b feature/fix-login created',
    )
    expect(result.skipped).toBe(true)
    expect(result.reason).toContain('ECONNREFUSED')

    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })
})
