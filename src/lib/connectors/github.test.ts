import { describe, expect, it, vi } from 'vitest'
import {
  getGitHubConnectorHealth,
  githubConnectorManifest,
  mapGitHubIssueToWorkItem,
  mapGitHubPullRequestToWorkItem,
} from './github'

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
