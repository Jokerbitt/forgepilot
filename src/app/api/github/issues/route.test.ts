/**
 * Tests for POST /api/github/issues and GET /api/github/issues
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockBriefWithRepo = {
  id: 'brief-1',
  title: 'My Project',
  status: 'accepted',
  githubRepoUrl: 'https://github.com/owner/my-project',
  githubRepoName: 'owner/my-project',
}
const mockBriefNoRepo = {
  id: 'brief-2',
  title: 'No Repo Brief',
  status: 'accepted',
  githubRepoUrl: undefined,
  githubRepoName: undefined,
}

const mockWorkPackages = [
  {
    id: 'wp-1',
    briefId: 'brief-1',
    title: 'Implement auth',
    description: 'OAuth flow implementation',
    status: 'ready',
    riskClass: 'A',
    estimatedHours: 4,
    definitionOfDone: ['Tests pass', 'PR merged'],
    tags: ['auth', 'backend'],
  },
  {
    id: 'wp-2',
    briefId: 'brief-1',
    title: 'Write tests',
    description: 'Unit and integration tests',
    status: 'backlog',
    riskClass: 'B',
    estimatedHours: 2,
    definitionOfDone: ['Coverage > 80%'],
    tags: ['test'],
  },
  {
    id: 'wp-done',
    briefId: 'brief-1',
    title: 'Already done',
    description: 'This is finished',
    status: 'done',
    riskClass: 'A',
    estimatedHours: 1,
    definitionOfDone: ['Done'],
    tags: [],
  },
]

vi.mock('@/lib/project-briefs', () => ({
  readProjectBriefs: vi.fn(() => [mockBriefWithRepo, mockBriefNoRepo]),
}))

vi.mock('@/lib/connectors/config', () => ({
  readConnectorConfigs: vi.fn(() => ({
    github: { token: 'ghp-test-token', owner: 'owner', repositories: ['my-project'] },
  })),
}))

vi.mock('@/lib/knowledge/milestone-store', () => ({
  getWorkPackagesByBriefId: vi.fn((briefId: string) =>
    mockWorkPackages.filter(wp => wp.briefId === briefId)
  ),
}))

vi.mock('@/lib/connectors/github', () => ({
  findGitHubIssueByTitle: vi.fn(async () => null),
  createGitHubIssue: vi.fn(async (_config: unknown, opts: { title: string }) => ({
    number: Math.floor(Math.random() * 1000) + 1,
    html_url: `https://github.com/owner/my-project/issues/1`,
    title: opts.title,
  })),
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))

function makePostRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/github/issues', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

function makeGetRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/github/issues')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return new NextRequest(url.toString())
}

describe('POST /api/github/issues', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates issues for all non-done work packages and returns 201', async () => {
    const { POST } = await import('./route')
    const res = await POST(makePostRequest({ briefId: 'brief-1' }))
    expect(res.status).toBe(201)
    const data = await res.json() as { created: unknown[]; skipped: unknown[] }
    expect(data.created).toHaveLength(2) // wp-1 and wp-2, not wp-done
    expect(data.skipped).toHaveLength(0)
  })

  it('skips already-existing issues (idempotency)', async () => {
    const { findGitHubIssueByTitle } = await import('@/lib/connectors/github')
    vi.mocked(findGitHubIssueByTitle).mockResolvedValueOnce({ number: 42, html_url: 'https://github.com/owner/my-project/issues/42', title: 'Implement auth' } as Awaited<ReturnType<typeof findGitHubIssueByTitle>>)

    const { POST } = await import('./route')
    const res = await POST(makePostRequest({ briefId: 'brief-1' }))
    const data = await res.json() as { created: unknown[]; skipped: Array<{ workPackageId: string; reason: string }> }
    expect(data.skipped).toHaveLength(1)
    expect(data.skipped[0].reason).toContain('#42')
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
  })

  it('returns 422 when brief has no linked repo and no config fallback', async () => {
    const { readConnectorConfigs } = await import('@/lib/connectors/config')
    vi.mocked(readConnectorConfigs).mockReturnValueOnce({
      github: { token: 'ghp-test', owner: '', repositories: [] },
    } as ReturnType<typeof readConnectorConfigs>)

    const { POST } = await import('./route')
    const res = await POST(makePostRequest({ briefId: 'brief-2' }))
    expect(res.status).toBe(422)
  })

  it('returns 400 on missing briefId', async () => {
    const { POST } = await import('./route')
    const res = await POST(makePostRequest({}))
    expect(res.status).toBe(400)
  })

  it('filters by specific workPackageIds when provided', async () => {
    const { createGitHubIssue } = await import('@/lib/connectors/github')
    const { POST } = await import('./route')
    await POST(makePostRequest({ briefId: 'brief-1', workPackageIds: ['wp-1'] }))
    expect(vi.mocked(createGitHubIssue)).toHaveBeenCalledTimes(1)
  })

  it('returns 200 (not 201) when all work packages are skipped', async () => {
    const { findGitHubIssueByTitle } = await import('@/lib/connectors/github')
    vi.mocked(findGitHubIssueByTitle).mockResolvedValue({ number: 1, html_url: 'u', title: 't' } as Awaited<ReturnType<typeof findGitHubIssueByTitle>>)

    const { POST } = await import('./route')
    const res = await POST(makePostRequest({ briefId: 'brief-1' }))
    expect(res.status).toBe(200)
  })
})

describe('GET /api/github/issues', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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

  it('returns 424 when GitHub not connected', async () => {
    const { readConnectorConfigs } = await import('@/lib/connectors/config')
    vi.mocked(readConnectorConfigs).mockReturnValueOnce({ github: { token: '' } } as ReturnType<typeof readConnectorConfigs>)

    const { GET } = await import('./route')
    const res = await GET(makeGetRequest({ briefId: 'brief-1' }))
    expect(res.status).toBe(424)
  })

  it('returns empty issues array when brief has no linked repo', async () => {
    const { GET } = await import('./route')
    const res = await GET(makeGetRequest({ briefId: 'brief-2' }))
    expect(res.status).toBe(200)
    const data = await res.json() as { issues: unknown[] }
    expect(data.issues).toHaveLength(0)
  })
})
