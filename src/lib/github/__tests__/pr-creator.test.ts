import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { PRCreationOptions } from '../pr-creator'

// ── Mock dependencies ────────────────────────────────────────────────────────

// Mock readStoredApiKeys before importing pr-creator
vi.mock('@/lib/connectors/config', () => ({
  readStoredApiKeys: vi.fn(() => ({})),
}))

// Mock child_process so resolveOwnerAndRepo can work in tests
vi.mock('child_process', () => ({
  execSync: vi.fn(() => 'git@github.com:TestOwner/test-repo.git'),
}))

// Mock fs so package.json fallback doesn't read from disk
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>()
  return {
    ...actual,
    readFileSync: vi.fn((filePath: unknown) => {
      if (typeof filePath === 'string' && filePath.endsWith('package.json')) {
        return JSON.stringify({ repository: 'https://github.com/TestOwner/test-repo.git' })
      }
      return actual.readFileSync(filePath as Parameters<typeof actual.readFileSync>[0])
    }),
  }
})

import { readStoredApiKeys } from '@/lib/connectors/config'

// ── Helpers ──────────────────────────────────────────────────────────────────

const mockReadStoredApiKeys = vi.mocked(readStoredApiKeys)

const DEFAULT_OPTS: PRCreationOptions = {
  title: 'feat(delegation): Test PR',
  body: '## Summary\n- Test task completed',
  branch: 'feature/test-task',
  baseBranch: 'main',
}

function mockFetchOk(pr: { html_url: string; number: number }) {
  return vi.fn().mockResolvedValue({
    status: 201,
    ok: true,
    json: async () => pr,
  })
}

function mockFetchError(status: number, body: Record<string, unknown>) {
  return vi.fn().mockResolvedValue({
    status,
    ok: false,
    json: async () => body,
  })
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('createGitHubPR', () => {
  beforeEach(() => {
    vi.resetModules()
    delete process.env.GITHUB_TOKEN
    delete process.env.GH_TOKEN
    delete process.env.GITHUB_REPOSITORY
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns error result (no throw) when no token is configured', async () => {
    // Ensure no token anywhere
    mockReadStoredApiKeys.mockReturnValue({})
    delete process.env.GITHUB_TOKEN
    delete process.env.GH_TOKEN

    const { createGitHubPR } = await import('../pr-creator')
    const result = await createGitHubPR(DEFAULT_OPTS)

    expect(result.status).toBe('error')
    expect(result.error).toContain('No GitHub token configured')
    expect(result.url).toBe('')
    expect(result.number).toBe(0)
  })

  it('parses a successful 201 PR response correctly', async () => {
    mockReadStoredApiKeys.mockReturnValue({ GITHUB_TOKEN: 'ghp_test_token_123' })
    process.env.GITHUB_REPOSITORY = 'TestOwner/test-repo'

    const fakePR = { html_url: 'https://github.com/TestOwner/test-repo/pull/42', number: 42 }
    const fetchSpy = mockFetchOk(fakePR)
    vi.stubGlobal('fetch', fetchSpy)

    const { createGitHubPR } = await import('../pr-creator')
    const result = await createGitHubPR(DEFAULT_OPTS)

    expect(result.status).toBe('created')
    expect(result.url).toBe('https://github.com/TestOwner/test-repo/pull/42')
    expect(result.number).toBe(42)
    expect(result.error).toBeUndefined()

    // Verify Authorization header is set but we never leak the token in the result
    const callArgs = fetchSpy.mock.calls[0]
    expect(callArgs[1]?.headers).toBeDefined()
    const headers = callArgs[1]?.headers as Record<string, string>
    expect(headers['Authorization']).toBe('Bearer ghp_test_token_123')
    // Token must not appear anywhere in the returned result
    expect(JSON.stringify(result)).not.toContain('ghp_test_token_123')
  })

  it('returns already_exists status on 422 with PR-already-exists error', async () => {
    mockReadStoredApiKeys.mockReturnValue({ GITHUB_TOKEN: 'ghp_test_token_456' })
    process.env.GITHUB_REPOSITORY = 'TestOwner/test-repo'

    const existingPR = { html_url: 'https://github.com/TestOwner/test-repo/pull/7', number: 7 }

    // First call → 422 (already exists)
    // Second call → fetch existing PR list (open PRs endpoint)
    const fetchSpy = vi.fn()
      .mockResolvedValueOnce({
        status: 422,
        ok: false,
        json: async () => ({
          message: 'Unprocessable Entity',
          errors: [{ message: 'A pull request already exists for feature/test-task.' }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [existingPR],
      })

    vi.stubGlobal('fetch', fetchSpy)

    const { createGitHubPR } = await import('../pr-creator')
    const result = await createGitHubPR(DEFAULT_OPTS)

    expect(result.status).toBe('already_exists')
    expect(result.url).toBe('https://github.com/TestOwner/test-repo/pull/7')
    expect(result.number).toBe(7)
  })

  it('returns error result on non-201/422 HTTP status', async () => {
    mockReadStoredApiKeys.mockReturnValue({ GITHUB_TOKEN: 'ghp_test_token_789' })
    process.env.GITHUB_REPOSITORY = 'TestOwner/test-repo'

    vi.stubGlobal('fetch', mockFetchError(403, { message: 'Resource not accessible by integration' }))

    const { createGitHubPR } = await import('../pr-creator')
    const result = await createGitHubPR(DEFAULT_OPTS)

    expect(result.status).toBe('error')
    expect(result.error).toContain('403')
    expect(result.url).toBe('')
  })

  it('returns error result on network failure (no throw)', async () => {
    mockReadStoredApiKeys.mockReturnValue({ GITHUB_TOKEN: 'ghp_test_token_net' })
    process.env.GITHUB_REPOSITORY = 'TestOwner/test-repo'

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')))

    const { createGitHubPR } = await import('../pr-creator')
    const result = await createGitHubPR(DEFAULT_OPTS)

    expect(result.status).toBe('error')
    expect(result.error).toContain('ECONNREFUSED')
    expect(result.url).toBe('')
  })
})
