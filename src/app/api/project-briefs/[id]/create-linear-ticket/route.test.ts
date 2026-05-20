import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from './route'

const mockBrief = {
  id: 'brief-001',
  title: 'Test Projekt',
  rawIdea: 'Eine tolle Idee',
  problemStatement: 'Das Problem ist klar',
  targetAudience: 'Entwickler',
  desiredOutcome: 'Eine funktionierende Lösung',
  requirements: [
    { id: 'r1', status: 'accepted', priority: 'must', title: 'Pflichtanforderung', description: 'Muss sein' },
    { id: 'r2', status: 'proposed', priority: 'should', title: 'Optional', description: 'Wäre gut' },
  ],
}

vi.mock('@/lib/project-briefs', () => ({
  findProjectBriefById: vi.fn(() => mockBrief),
}))

vi.mock('@/lib/connectors/config', () => ({
  readConnectorConfigs: vi.fn(() => ({
    linear: { apiKey: 'lin_api_test', teamId: 'team-123' },
    github: {},
  })),
}))

vi.mock('@/lib/connectors/linear', () => ({
  createLinearIssue: vi.fn(() => Promise.resolve({
    id: 'issue-abc',
    identifier: 'FP-42',
    url: 'https://linear.app/team/issue/FP-42',
  })),
}))

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

describe('POST /api/project-briefs/[id]/create-linear-ticket', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 404 when brief not found', async () => {
    const { findProjectBriefById } = await import('@/lib/project-briefs')
    vi.mocked(findProjectBriefById).mockReturnValueOnce(undefined)
    const res = await POST(new Request('http://localhost'), makeParams('not-found'))
    expect(res.status).toBe(404)
  })

  it('returns 503 when LINEAR_API_KEY is missing', async () => {
    const { readConnectorConfigs } = await import('@/lib/connectors/config')
    vi.mocked(readConnectorConfigs).mockReturnValueOnce({ linear: { teamId: 'team-123' }, github: {} })
    const res = await POST(new Request('http://localhost'), makeParams('brief-001'))
    expect(res.status).toBe(503)
    const data = await res.json()
    expect(data.error).toMatch(/LINEAR_API_KEY/)
  })

  it('returns 503 when LINEAR_TEAM_ID is missing', async () => {
    const { readConnectorConfigs } = await import('@/lib/connectors/config')
    vi.mocked(readConnectorConfigs).mockReturnValueOnce({ linear: { apiKey: 'lin_api_test' }, github: {} })
    const res = await POST(new Request('http://localhost'), makeParams('brief-001'))
    expect(res.status).toBe(503)
    const data = await res.json()
    expect(data.error).toMatch(/LINEAR_TEAM_ID/)
  })

  it('creates ticket and returns issueId, identifier, url', async () => {
    const res = await POST(new Request('http://localhost'), makeParams('brief-001'))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toMatchObject({ issueId: 'issue-abc', identifier: 'FP-42', url: 'https://linear.app/team/issue/FP-42' })
  })

  it('passes only accepted requirements to the description', async () => {
    const { createLinearIssue } = await import('@/lib/connectors/linear')
    await POST(new Request('http://localhost'), makeParams('brief-001'))
    const calls = vi.mocked(createLinearIssue).mock.calls
    expect(calls[0][1].description).toContain('Pflichtanforderung')
    expect(calls[0][1].description).not.toContain('Optional')
  })

  it('returns 500 when createLinearIssue throws', async () => {
    const { createLinearIssue } = await import('@/lib/connectors/linear')
    vi.mocked(createLinearIssue).mockRejectedValueOnce(new Error('Network error'))
    const res = await POST(new Request('http://localhost'), makeParams('brief-001'))
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toBe('Network error')
  })
})
