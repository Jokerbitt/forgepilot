/**
 * Tests for POST /api/github/repos and GET /api/github/repos
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockBriefs = [
  {
    id: 'brief-1',
    title: 'My Awesome Project',
    status: 'accepted',
    problemStatement: 'A great problem to solve',
    rawIdea: 'A raw idea',
    githubRepoUrl: undefined,
    githubRepoName: undefined,
  },
  {
    id: 'brief-2',
    title: 'Already Has Repo',
    status: 'accepted',
    githubRepoUrl: 'https://github.com/owner/already-has-repo',
    githubRepoName: 'owner/already-has-repo',
  },
]

vi.mock('@/lib/project-briefs', () => ({
  readProjectBriefs: vi.fn(() => [...mockBriefs]),
  updateProjectBrief: vi.fn((id: string, updates: Record<string, unknown>) => ({ ...mockBriefs.find(b => b.id === id), ...updates })),
  saveProjectBrief: vi.fn(),
}))

vi.mock('@/lib/connectors/config', () => ({
  readConnectorConfigs: vi.fn(() => ({
    github: { token: 'ghp-test-token', owner: 'testowner' },
  })),
}))

vi.mock('@/lib/connectors/github', () => ({
  createGitHubRepo: vi.fn(async () => ({
    html_url: 'https://github.com/testowner/my-awesome-project',
    full_name: 'testowner/my-awesome-project',
    clone_url: 'https://github.com/testowner/my-awesome-project.git',
    private: true,
  })),
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))

function makePostRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/github/repos', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

function makeGetRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/github/repos')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return new NextRequest(url.toString())
}

describe('POST /api/github/repos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a GitHub repo for a brief and returns 201', async () => {
    const { POST } = await import('./route')
    const res = await POST(makePostRequest({ briefId: 'brief-1' }))
    expect(res.status).toBe(201)
    const data = await res.json() as { repoUrl: string; repoName: string; alreadyExists: boolean }
    expect(data.repoUrl).toBe('https://github.com/testowner/my-awesome-project')
    expect(data.repoName).toBe('testowner/my-awesome-project')
    expect(data.alreadyExists).toBe(false)
  })

  it('returns 200 with alreadyExists=true when repo already linked', async () => {
    const { POST } = await import('./route')
    const res = await POST(makePostRequest({ briefId: 'brief-2' }))
    expect(res.status).toBe(200)
    const data = await res.json() as { alreadyExists: boolean; repoUrl: string }
    expect(data.alreadyExists).toBe(true)
    expect(data.repoUrl).toBe('https://github.com/owner/already-has-repo')
  })

  it('returns 404 when brief not found', async () => {
    const { POST } = await import('./route')
    const res = await POST(makePostRequest({ briefId: 'nonexistent' }))
    expect(res.status).toBe(404)
  })

  it('returns 424 when GitHub not connected', async () => {
    const { readConnectorConfigs } = await import('@/lib/connectors/config')
    vi.mocked(readConnectorConfigs).mockReturnValueOnce({ github: { token: '' } } as ReturnType<typeof readConnectorConfigs>)

    const { POST } = await import('./route')
    const res = await POST(makePostRequest({ briefId: 'brief-1' }))
    expect(res.status).toBe(424)
    const data = await res.json() as { error: string }
    expect(data.error).toContain('GitHub not connected')
  })

  it('returns 400 on invalid body (missing briefId)', async () => {
    const { POST } = await import('./route')
    const res = await POST(makePostRequest({}))
    expect(res.status).toBe(400)
  })

  it('passes custom name and isPrivate to createGitHubRepo', async () => {
    const { createGitHubRepo } = await import('@/lib/connectors/github')
    const { POST } = await import('./route')
    await POST(makePostRequest({ briefId: 'brief-1', name: 'custom-slug', isPrivate: false }))
    expect(vi.mocked(createGitHubRepo)).toHaveBeenCalledWith(
      expect.objectContaining({ token: 'ghp-test-token' }),
      expect.objectContaining({ name: 'custom-slug', isPrivate: false }),
    )
  })

  it('returns 500 when createGitHubRepo throws', async () => {
    const { createGitHubRepo } = await import('@/lib/connectors/github')
    vi.mocked(createGitHubRepo).mockRejectedValueOnce(new Error('API rate limit'))

    const { POST } = await import('./route')
    const res = await POST(makePostRequest({ briefId: 'brief-1' }))
    expect(res.status).toBe(500)
    const data = await res.json() as { error: string }
    expect(data.error).toContain('API rate limit')
  })
})

describe('GET /api/github/repos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns repoUrl and repoName for a brief with a linked repo', async () => {
    const { GET } = await import('./route')
    const res = await GET(makeGetRequest({ briefId: 'brief-2' }))
    expect(res.status).toBe(200)
    const data = await res.json() as { repoUrl: string; repoName: string }
    expect(data.repoUrl).toBe('https://github.com/owner/already-has-repo')
    expect(data.repoName).toBe('owner/already-has-repo')
  })

  it('returns null values for a brief without a linked repo', async () => {
    const { GET } = await import('./route')
    const res = await GET(makeGetRequest({ briefId: 'brief-1' }))
    expect(res.status).toBe(200)
    const data = await res.json() as { repoUrl: null; repoName: null }
    expect(data.repoUrl).toBeNull()
    expect(data.repoName).toBeNull()
  })

  it('returns 400 when briefId is missing', async () => {
    const { GET } = await import('./route')
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(400)
  })

  it('returns 404 when brief not found', async () => {
    const { GET } = await import('./route')
    const res = await GET(makeGetRequest({ briefId: 'nonexistent' }))
    expect(res.status).toBe(404)
  })
})
