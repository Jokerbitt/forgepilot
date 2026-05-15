import { describe, it, expect, vi } from 'vitest'
import { fetchLinearWorkItems } from './linear-items'

function makeIssueResponse(overrides: Record<string, unknown> = {}) {
  return {
    id: 'issue-1',
    identifier: 'FP-1',
    title: 'Test issue',
    url: 'https://linear.app/test/issue/FP-1',
    priority: 2,
    state: { type: 'started', name: 'In Progress' },
    project: { id: 'proj-1' },
    team: { id: 'team-1' },
    labels: { nodes: [] },
    assignee: null,
    updatedAt: '2026-05-15T10:00:00Z',
    createdAt: '2026-05-01T10:00:00Z',
    ...overrides,
  }
}

function mockFetcher(issues: unknown[]) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ data: { issues: { nodes: issues } } }),
  })
}

describe('fetchLinearWorkItems', () => {
  it('returns empty array when config is missing', async () => {
    const items = await fetchLinearWorkItems({})
    expect(items).toEqual([])
  })

  it('returns empty array when apiKey missing', async () => {
    const items = await fetchLinearWorkItems({ teamId: 'team-1' })
    expect(items).toEqual([])
  })

  it('returns empty array when teamId missing', async () => {
    const items = await fetchLinearWorkItems({ apiKey: 'lin_api_test' })
    expect(items).toEqual([])
  })

  it('fetches and maps Linear issues to WorkItems', async () => {
    const fetcher = mockFetcher([makeIssueResponse()])
    const items = await fetchLinearWorkItems({ apiKey: 'lin_api_test', teamId: 'team-1' }, 50, fetcher)

    expect(items).toHaveLength(1)
    expect(items[0].id).toBe('issue-1')
    expect(items[0].source).toBe('linear')
    expect(items[0].type).toBe('ticket')
    expect(items[0].title).toBe('FP-1: Test issue')
    expect(items[0].status).toBe('in-progress')
  })

  it('throws on HTTP error', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: false, status: 500 })
    await expect(
      fetchLinearWorkItems({ apiKey: 'lin_api_test', teamId: 'team-1' }, 50, fetcher),
    ).rejects.toThrow('Linear API returned HTTP 500')
  })

  it('throws on GraphQL errors', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ errors: [{ message: 'not found' }] }),
    })
    await expect(
      fetchLinearWorkItems({ apiKey: 'lin_api_test', teamId: 'team-1' }, 50, fetcher),
    ).rejects.toThrow('Linear GraphQL returned errors')
  })
})
