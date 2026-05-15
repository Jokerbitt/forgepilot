import { describe, it, expect, vi } from 'vitest'
import { fetchGitHubWorkItems } from './github-items'

function makePR(overrides: Record<string, unknown> = {}) {
  return {
    id: 101,
    number: 1,
    title: 'feat: add feature',
    html_url: 'https://github.com/owner/repo/pull/1',
    state: 'open',
    draft: false,
    merged_at: null,
    labels: [],
    user: { login: 'dev' },
    updated_at: '2026-05-15T10:00:00Z',
    created_at: '2026-05-01T10:00:00Z',
    ...overrides,
  }
}

function makeIssue(overrides: Record<string, unknown> = {}) {
  return {
    id: 201,
    number: 2,
    title: 'bug: fix crash',
    html_url: 'https://github.com/owner/repo/issues/2',
    state: 'open',
    labels: [{ name: 'bug' }],
    user: { login: 'dev' },
    updated_at: '2026-05-15T11:00:00Z',
    created_at: '2026-05-02T10:00:00Z',
    ...overrides,
  }
}

function mockFetcher(prList: unknown[], issueList: unknown[]) {
  return vi.fn().mockImplementation((url: string) => {
    if (url.includes('/pulls')) {
      return Promise.resolve({ ok: true, json: async () => prList })
    }
    return Promise.resolve({ ok: true, json: async () => issueList })
  })
}

describe('fetchGitHubWorkItems', () => {
  it('returns empty array when config is missing', async () => {
    const items = await fetchGitHubWorkItems({})
    expect(items).toEqual([])
  })

  it('returns empty array when repositories is empty', async () => {
    const items = await fetchGitHubWorkItems({ token: 'ghp_test', owner: 'owner', repositories: [] })
    expect(items).toEqual([])
  })

  it('fetches PRs and issues, skips PR-type issues', async () => {
    const prWithIssueFlag = { ...makeIssue({ id: 202 }), pull_request: { url: 'x' } }
    const fetcher = mockFetcher([makePR()], [makeIssue(), prWithIssueFlag])

    const items = await fetchGitHubWorkItems(
      { token: 'ghp_test', owner: 'owner', repositories: ['repo'] },
      fetcher,
    )

    expect(items).toHaveLength(2) // 1 PR + 1 issue (prWithIssueFlag skipped)
    expect(items.some((i) => i.type === 'pr')).toBe(true)
    expect(items.some((i) => i.type === 'issue')).toBe(true)
    expect(items.every((i) => i.source === 'github')).toBe(true)
  })

  it('handles failed API responses gracefully (continues)', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => [] })
    const items = await fetchGitHubWorkItems(
      { token: 'ghp_test', owner: 'owner', repositories: ['repo'] },
      fetcher,
    )
    expect(items).toEqual([])
  })

  it('fetches from multiple repositories', async () => {
    const fetcher = mockFetcher([makePR()], [])
    const items = await fetchGitHubWorkItems(
      { token: 'ghp_test', owner: 'owner', repositories: ['repo1', 'repo2'] },
      fetcher,
    )
    expect(items).toHaveLength(2) // 1 PR per repo
  })
})
