import { describe, expect, it, vi, beforeEach } from 'vitest'
import { POST } from './route'
import { getGitHubPullRequestPreview, mergeGitHubPullRequest } from '@/lib/connectors/github'

vi.mock('@/lib/connectors/config', () => ({
  readConnectorConfigs: vi.fn(() => ({ github: { owner: 'Jokerbitt', repositories: ['forgepilot'] } })),
}))

vi.mock('@/lib/connectors/github', () => ({
  getGitHubPullRequestPreview: vi.fn(),
  mergeGitHubPullRequest: vi.fn(),
}))

const params = { params: Promise.resolve({ number: '576' }) }

function request(body: unknown) {
  return new Request('http://localhost/api/github/pull-requests/576/merge', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

function preview(overrides: Record<string, unknown> = {}) {
  return {
    number: 576,
    title: 'Safe PR',
    state: 'open',
    draft: false,
    mergeable: true,
    headSha: 'abc123',
    mergeRecommendation: {
      status: 'ready',
      reasons: ['PR ist offen, mergebar und Checks sind gruen.'],
    },
    ...overrides,
  }
}

describe('POST /api/github/pull-requests/[number]/merge', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('requires the review checklist before merging', async () => {
    const response = await POST(request({ confirm: true, sha: 'abc123' }), params)

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Review checklist is required before merging' })
    expect(mergeGitHubPullRequest).not.toHaveBeenCalled()
  })

  it('blocks review-only pull requests even with a checklist', async () => {
    vi.mocked(getGitHubPullRequestPreview).mockResolvedValue(preview({
      mergeRecommendation: {
        status: 'review',
        reasons: ['Checks sind noch unbekannt.'],
      },
    }) as never)

    const response = await POST(request({
      confirm: true,
      sha: 'abc123',
      review: { filesReviewed: true, checksReviewed: true, noSecrets: true },
    }), params)

    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ error: 'Pull request is not merge-ready' })
    expect(mergeGitHubPullRequest).not.toHaveBeenCalled()
  })

  it('merges a ready pull request after explicit checklist confirmation', async () => {
    vi.mocked(getGitHubPullRequestPreview).mockResolvedValue(preview() as never)
    vi.mocked(mergeGitHubPullRequest).mockResolvedValue({
      merged: true,
      sha: 'merge-sha',
      message: 'Merged',
    } as never)

    const response = await POST(request({
      confirm: true,
      sha: 'abc123',
      review: { filesReviewed: true, checksReviewed: true, noSecrets: true },
    }), params)

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ ok: true })
    expect(mergeGitHubPullRequest).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      number: 576,
      sha: 'abc123',
      title: 'Safe PR',
    }))
  })
})
