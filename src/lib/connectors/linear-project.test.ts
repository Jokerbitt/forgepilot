/**
 * Tests for createLinearProject, findOrCreateLinearProject, and the
 * updated createLinearIssue (projectId support).
 */
import { describe, it, expect, vi } from 'vitest'
import {
  createLinearProject,
  findLinearProjectByName,
  findOrCreateLinearProject,
  createLinearIssue,
} from './linear'

const BASE_CONFIG = { apiKey: 'test-key', teamId: 'team-1' }

function mockFetch(payload: unknown, status = 200): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(payload),
    text: () => Promise.resolve(JSON.stringify(payload)),
  } as Response)
}

// ─── createLinearProject ──────────────────────────────────────────────────────

describe('createLinearProject', () => {
  it('calls projectCreate mutation and returns project', async () => {
    const fetcher = mockFetch({
      data: {
        projectCreate: {
          success: true,
          project: { id: 'proj-1', name: 'Test Project', url: 'https://linear.app/p/test', slugId: 'test' },
        },
      },
    })

    const result = await createLinearProject(BASE_CONFIG, { teamId: 'team-1', name: 'Test Project' }, fetcher)

    expect(result.id).toBe('proj-1')
    expect(result.name).toBe('Test Project')
    expect(result.url).toBe('https://linear.app/p/test')

    const body = JSON.parse((vi.mocked(fetcher).mock.calls[0][1] as RequestInit).body as string) as { variables: { name: string; teamIds: string[] } }
    expect(body.variables.name).toBe('Test Project')
    expect(body.variables.teamIds).toContain('team-1')
  })

  it('throws when API key is missing', async () => {
    const fetcher = mockFetch({})
    await expect(createLinearProject({ apiKey: undefined }, { teamId: 'team-1', name: 'X' }, fetcher))
      .rejects.toThrow('LINEAR_API_KEY not configured')
  })

  it('throws when GraphQL returns errors', async () => {
    const fetcher = mockFetch({ errors: [{ message: 'Not authorized' }] })
    await expect(createLinearProject(BASE_CONFIG, { teamId: 'team-1', name: 'X' }, fetcher))
      .rejects.toThrow('Linear GraphQL error')
  })

  it('throws when project is missing from response', async () => {
    const fetcher = mockFetch({ data: { projectCreate: { success: true, project: null } } })
    await expect(createLinearProject(BASE_CONFIG, { teamId: 'team-1', name: 'X' }, fetcher))
      .rejects.toThrow('Linear did not return a created project')
  })

  it('passes description and state to API', async () => {
    const fetcher = mockFetch({
      data: {
        projectCreate: {
          success: true,
          project: { id: 'p2', name: 'Brief', url: 'url', slugId: 'brief' },
        },
      },
    })

    await createLinearProject(BASE_CONFIG, {
      teamId: 'team-1', name: 'Brief', description: 'Desc', state: 'planned',
    }, fetcher)

    const body = JSON.parse((vi.mocked(fetcher).mock.calls[0][1] as RequestInit).body as string) as { variables: { description: string; state: string } }
    expect(body.variables.description).toBe('Desc')
    expect(body.variables.state).toBe('planned')
  })
})

// ─── findLinearProjectByName ──────────────────────────────────────────────────

describe('findLinearProjectByName', () => {
  it('returns null when no project matches', async () => {
    const fetcher = mockFetch({ data: { projects: { nodes: [] } } })
    const result = await findLinearProjectByName(BASE_CONFIG, { teamId: 'team-1', name: 'X' }, fetcher)
    expect(result).toBeNull()
  })

  it('returns first matching project', async () => {
    const fetcher = mockFetch({
      data: {
        projects: {
          nodes: [{ id: 'proj-x', name: 'Found', url: 'https://linear.app/p/found', slugId: 'found' }],
        },
      },
    })
    const result = await findLinearProjectByName(BASE_CONFIG, { teamId: 'team-1', name: 'Found' }, fetcher)
    expect(result?.id).toBe('proj-x')
    expect(result?.name).toBe('Found')
  })

  it('returns null on HTTP error (non-throwing)', async () => {
    const fetcher = mockFetch({}, 500)
    const result = await findLinearProjectByName(BASE_CONFIG, { teamId: 'team-1', name: 'X' }, fetcher)
    expect(result).toBeNull()
  })
})

// ─── findOrCreateLinearProject ────────────────────────────────────────────────

describe('findOrCreateLinearProject', () => {
  it('returns existing project without creating a new one', async () => {
    let callCount = 0
    const fetcher = vi.fn().mockImplementation(() => {
      callCount++
      const payload = callCount === 1
        // findLinearProjectByName call
        ? { data: { projects: { nodes: [{ id: 'existing', name: 'My Project', url: 'u', slugId: 's' }] } } }
        // createLinearProject should NOT be called
        : { data: { projectCreate: { success: true, project: { id: 'new', name: 'My Project', url: 'u2', slugId: 's2' } } } }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(payload), text: () => Promise.resolve('') } as Response)
    })

    const result = await findOrCreateLinearProject(BASE_CONFIG, { teamId: 'team-1', name: 'My Project' }, fetcher)

    expect(result.id).toBe('existing')
    expect(callCount).toBe(1) // only find, not create
  })

  it('creates project when none found', async () => {
    let callCount = 0
    const fetcher = vi.fn().mockImplementation(() => {
      callCount++
      const payload = callCount === 1
        ? { data: { projects: { nodes: [] } } }
        : { data: { projectCreate: { success: true, project: { id: 'created', name: 'New', url: 'u', slugId: 's' } } } }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(payload), text: () => Promise.resolve('') } as Response)
    })

    const result = await findOrCreateLinearProject(BASE_CONFIG, { teamId: 'team-1', name: 'New' }, fetcher)

    expect(result.id).toBe('created')
    expect(callCount).toBe(2)
  })
})

// ─── createLinearIssue with projectId ─────────────────────────────────────────

describe('createLinearIssue with projectId', () => {
  it('includes projectId in mutation variables', async () => {
    const fetcher = mockFetch({
      data: { issueCreate: { success: true, issue: { id: 'i1', identifier: 'FP-1', url: 'u' } } },
    })

    await createLinearIssue(BASE_CONFIG, {
      teamId: 'team-1',
      title: 'My Issue',
      projectId: 'proj-abc',
    }, fetcher)

    const body = JSON.parse((vi.mocked(fetcher).mock.calls[0][1] as RequestInit).body as string) as { variables: { projectId: string } }
    expect(body.variables.projectId).toBe('proj-abc')
  })

  it('sends null projectId when omitted', async () => {
    const fetcher = mockFetch({
      data: { issueCreate: { success: true, issue: { id: 'i2', identifier: 'FP-2', url: 'u' } } },
    })

    await createLinearIssue(BASE_CONFIG, { teamId: 'team-1', title: 'No Project' }, fetcher)

    const body = JSON.parse((vi.mocked(fetcher).mock.calls[0][1] as RequestInit).body as string) as { variables: { projectId: unknown } }
    expect(body.variables.projectId).toBeNull()
  })
})
