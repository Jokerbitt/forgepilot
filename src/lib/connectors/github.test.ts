import { describe, expect, it, vi } from 'vitest'
import {
  deleteGitHubBranch,
  getGitHubConnectorHealth,
  getGitHubPullRequestPreview,
  githubConnectorManifest,
  mapGitHubIssueToWorkItem,
  mapGitHubPullRequestToWorkItem,
  updateGitHubPullRequestBranch,
} from './github'

const REPO_CONFIG = { token: 'ghp_test', owner: 'Jokerbitt', repositories: ['forgepilot'] }

describe('githubConnectorManifest', () => {
  it('declares GitHub as a code connector', () => {
    expect(githubConnectorManifest.id).toBe('github')
    expect(githubConnectorManifest.category).toBe('code')
    expect(githubConnectorManifest.capabilities).toContain('read-prs')
    expect(githubConnectorManifest.capabilities).toContain('read-ci')
  })
})

describe('getGitHubConnectorHealth', () => {
  it('returns unconfigured when required config is missing', async () => {
    const health = await getGitHubConnectorHealth({})

    expect(health.status).toBe('unconfigured')
    expect(health.errorMessage).toContain('token')
    expect(health.errorMessage).toContain('owner')
    expect(health.errorMessage).toContain('repositories')
  })

  it('returns ok and rate limit data for a successful health check', async () => {
    const headers = new Headers({
      'x-ratelimit-remaining': '4999',
      'x-ratelimit-reset': '1770000000',
    })
    const fetcher = vi.fn().mockResolvedValue(new Response('{}', { status: 200, headers }))

    const health = await getGitHubConnectorHealth(
      { token: 'ghp_test', owner: 'Jokerbitt', repositories: ['forgepilot'] },
      fetcher,
    )

    expect(health.status).toBe('ok')
    expect(health.rateLimit?.remaining).toBe(4999)
    expect(fetcher).toHaveBeenCalledWith(
      'https://api.github.com/user',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer ghp_test' }) }),
    )
  })

  it('returns error for authentication failure', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('{}', { status: 401 }))

    const health = await getGitHubConnectorHealth(
      { token: 'bad', owner: 'Jokerbitt', repositories: ['forgepilot'] },
      fetcher,
    )

    expect(health.status).toBe('error')
    expect(health.errorMessage).toContain('authentication')
  })
})

describe('GitHub WorkItem mappers', () => {
  it('normalizes a pull request into a WorkItem', () => {
    const item = mapGitHubPullRequestToWorkItem(
      {
        id: 10,
        number: 2,
        title: 'feat: add connector layer',
        html_url: 'https://github.com/Jokerbitt/forgepilot/pull/2',
        state: 'open',
        draft: false,
        merged_at: null,
        labels: [{ name: 'priority: high' }],
        user: { login: 'Jokerbitt' },
        updated_at: '2026-05-15T20:00:00Z',
        created_at: '2026-05-15T19:00:00Z',
      },
      'forgepilot',
      'Jokerbitt',
    )

    expect(item.source).toBe('github')
    expect(item.type).toBe('pr')
    expect(item.status).toBe('in-review')
    expect(item.priority).toBe(1)
    expect(item.projectId).toBe('Jokerbitt/forgepilot')
  })

  it('marks security issues as RiskClass C', () => {
    const item = mapGitHubIssueToWorkItem(
      {
        id: 11,
        number: 3,
        title: 'Rotate leaked secret',
        html_url: 'https://github.com/Jokerbitt/forgepilot/issues/3',
        state: 'open',
        labels: [{ name: 'security' }],
        user: { login: 'Jokerbitt' },
        updated_at: '2026-05-15T20:00:00Z',
        created_at: '2026-05-15T19:00:00Z',
      },
      'forgepilot',
      'Jokerbitt',
    )

    expect(item.risk).toBe('C')
    expect(item.aiDelegable).toBe(false)
  })
})

describe('getGitHubPullRequestPreview merge recommendation', () => {
  function jsonResponse(body: unknown): Response {
    return new Response(JSON.stringify(body), { status: 200 })
  }

  it('flags a behind-base PR as needing a rebase', async () => {
    const fetcher = vi.fn((url: string) => {
      if (/\/pulls\/7\/files/.test(url)) return Promise.resolve(jsonResponse([]))
      if (/\/pulls\/7\/commits/.test(url)) return Promise.resolve(jsonResponse([]))
      if (/\/commits\/sha7\/check-runs/.test(url)) {
        return Promise.resolve(jsonResponse({ check_runs: [{ name: 'build', conclusion: 'success', status: 'completed' }] }))
      }
      // base PR detail
      return Promise.resolve(jsonResponse({
        id: 7, number: 7, title: 'Stale PR', html_url: 'https://github.com/Jokerbitt/forgepilot/pull/7',
        state: 'open', mergeable: true, mergeable_state: 'behind',
        head: { ref: 'feature/stale', sha: 'sha7' }, base: { ref: 'main' },
        additions: 10, deletions: 2, changed_files: 1, commits: 1,
        updated_at: '2026-06-01T00:00:00.000Z', created_at: '2026-06-01T00:00:00.000Z',
      }))
    })

    const result = await getGitHubPullRequestPreview(REPO_CONFIG, 7, fetcher as never)

    expect(result.mergeableState).toBe('behind')
    expect(result.mergeRecommendation.status).toBe('review')
    expect(result.mergeRecommendation.reasons.join(' ')).toContain('hinter dem Base-Branch')
  })
})

describe('updateGitHubPullRequestBranch', () => {
  it('reports updated when GitHub queues the branch update (202)', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'Updating pull request branch.' }), { status: 202 }),
    )

    const result = await updateGitHubPullRequestBranch(REPO_CONFIG, 42, 'headsha', fetcher)

    expect(result.updated).toBe(true)
    expect(fetcher).toHaveBeenCalledWith(
      'https://api.github.com/repos/Jokerbitt/forgepilot/pulls/42/update-branch',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ expected_head_sha: 'headsha' }),
      }),
    )
  })

  it('treats 422 (already up to date / sha race) as a non-fatal no-op', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'merge conflict between base and head' }), { status: 422 }),
    )

    const result = await updateGitHubPullRequestBranch(REPO_CONFIG, 42, undefined, fetcher)

    expect(result.updated).toBe(false)
  })

  it('throws on unexpected status', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('boom', { status: 500 }))

    await expect(updateGitHubPullRequestBranch(REPO_CONFIG, 42, undefined, fetcher)).rejects.toThrow(/HTTP 500/)
  })
})

describe('deleteGitHubBranch', () => {
  it('deletes the ref and returns true on 204', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))

    const deleted = await deleteGitHubBranch(REPO_CONFIG, 'feature/jok-123-task', fetcher)

    expect(deleted).toBe(true)
    expect(fetcher).toHaveBeenCalledWith(
      'https://api.github.com/repos/Jokerbitt/forgepilot/git/refs/heads/feature%2Fjok-123-task',
      expect.objectContaining({ method: 'DELETE' }),
    )
  })

  it('strips a refs/heads/ prefix before calling the API', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))

    await deleteGitHubBranch(REPO_CONFIG, 'refs/heads/fix/abc', fetcher)

    expect(fetcher).toHaveBeenCalledWith(
      'https://api.github.com/repos/Jokerbitt/forgepilot/git/refs/heads/fix%2Fabc',
      expect.anything(),
    )
  })

  it('returns false when the ref is already gone (404)', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('{}', { status: 404 }))

    expect(await deleteGitHubBranch(REPO_CONFIG, 'feature/gone', fetcher)).toBe(false)
  })

  it('refuses to delete a protected base branch', async () => {
    const fetcher = vi.fn()

    await expect(deleteGitHubBranch(REPO_CONFIG, 'main', fetcher)).rejects.toThrow(/protected branch/)
    await expect(deleteGitHubBranch(REPO_CONFIG, 'refs/heads/master', fetcher)).rejects.toThrow(/protected branch/)
    expect(fetcher).not.toHaveBeenCalled()
  })
})
