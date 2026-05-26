/**
 * @vitest-environment node
 *
 * Tests for GET /api/github/pull-requests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockListGitHubPullRequests = vi.fn()

vi.mock('@/lib/connectors/config', () => ({
  readConnectorConfigs: vi.fn(() => ({
    github: {
      token: 'test-token',
      owner: 'TestOrg',
      repositories: ['test-repo'],
    },
    linear: undefined,
  })),
}))

vi.mock('@/lib/connectors/github', () => ({
  listGitHubPullRequests: (...args: unknown[]) => mockListGitHubPullRequests(...args),
}))

const mockPRs = [
  { number: 1, title: 'feat: add smoke test', state: 'open', url: 'https://github.com/TestOrg/test-repo/pull/1' },
  { number: 2, title: 'fix: budget guard', state: 'closed', url: 'https://github.com/TestOrg/test-repo/pull/2' },
]

beforeEach(() => {
  vi.clearAllMocks()
  mockListGitHubPullRequests.mockResolvedValue(mockPRs)
})

describe('GET /api/github/pull-requests', () => {
  it('returns pull requests and repository info', async () => {
    const { GET } = await import('./route')
    const res = await GET()

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.pullRequests).toHaveLength(2)
    expect(body.repository.owner).toBe('TestOrg')
    expect(body.repository.name).toBe('test-repo')
  })

  it('passes github config to listGitHubPullRequests', async () => {
    const { GET } = await import('./route')
    await GET()

    expect(mockListGitHubPullRequests).toHaveBeenCalledWith(
      expect.objectContaining({ token: 'test-token' }),
    )
  })

  it('returns 500 when GitHub API throws', async () => {
    mockListGitHubPullRequests.mockRejectedValueOnce(new Error('GitHub API rate limited'))

    const { GET } = await import('./route')
    const res = await GET()

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toContain('GitHub API rate limited')
  })

  it('uses fallback owner/repo when github config is missing', async () => {
    const { readConnectorConfigs } = await import('@/lib/connectors/config')
    vi.mocked(readConnectorConfigs).mockReturnValueOnce({ github: undefined, linear: undefined })

    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json()

    expect(body.repository.owner).toBe('Jokerbitt')
    expect(body.repository.name).toBe('forgepilot')
  })
})
