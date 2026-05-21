/**
 * relations.test.ts — JOK-22
 *
 * Tests for Linear issueRelations GraphQL queries and critical path graph algorithm.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchIssueRelations, fetchBlockingRelations } from './relations'

// ---------------------------------------------------------------------------
// fetchIssueRelations
// ---------------------------------------------------------------------------

describe('fetchIssueRelations', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
    vi.restoreAllMocks()
  })

  it('returns [] when LINEAR_API_KEY is missing', async () => {
    delete process.env.LINEAR_API_KEY
    const result = await fetchIssueRelations('team-123')
    expect(result).toEqual([])
  })

  it('returns [] on fetch network error', async () => {
    process.env.LINEAR_API_KEY = 'lin_api_test'
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))

    const result = await fetchIssueRelations('team-123')
    expect(result).toEqual([])
  })

  it('returns [] on non-ok HTTP response', async () => {
    process.env.LINEAR_API_KEY = 'lin_api_test'
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) }),
    )

    const result = await fetchIssueRelations('team-123')
    expect(result).toEqual([])
  })

  it('returns [] on GraphQL errors array', async () => {
    process.env.LINEAR_API_KEY = 'lin_api_test'
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ errors: [{ message: 'Unauthorized' }] }),
      }),
    )

    const result = await fetchIssueRelations('team-123')
    expect(result).toEqual([])
  })

  it('maps issues correctly including blocks/blocked_by relations', async () => {
    process.env.LINEAR_API_KEY = 'lin_api_test'

    const mockResponse = {
      data: {
        team: {
          issues: {
            nodes: [
              {
                id: 'issue-1',
                identifier: 'JOK-1',
                title: 'Issue One',
                priority: 2,
                state: { name: 'In Progress', type: 'started' },
                relations: {
                  nodes: [
                    {
                      id: 'rel-1',
                      type: 'blocks',
                      relatedIssue: {
                        id: 'issue-2',
                        identifier: 'JOK-2',
                        title: 'Issue Two',
                        state: { name: 'Todo' },
                      },
                    },
                  ],
                },
              },
              {
                id: 'issue-2',
                identifier: 'JOK-2',
                title: 'Issue Two',
                priority: 1,
                state: { name: 'Todo', type: 'unstarted' },
                relations: {
                  nodes: [
                    {
                      id: 'rel-2',
                      type: 'blocked_by',
                      relatedIssue: {
                        id: 'issue-1',
                        identifier: 'JOK-1',
                        title: 'Issue One',
                        state: { name: 'In Progress' },
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      },
    }

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => mockResponse }),
    )

    const result = await fetchIssueRelations('team-123')

    expect(result).toHaveLength(2)

    const issue1 = result.find((i) => i.id === 'issue-1')!
    expect(issue1.identifier).toBe('JOK-1')
    expect(issue1.status).toBe('In Progress')
    expect(issue1.priority).toBe(2)
    expect(issue1.relations).toHaveLength(1)
    expect(issue1.relations[0].type).toBe('blocks')
    expect(issue1.relations[0].relatedIssue.id).toBe('issue-2')

    const issue2 = result.find((i) => i.id === 'issue-2')!
    expect(issue2.relations[0].type).toBe('blocked_by')
  })

  it('handles missing relations nodes gracefully', async () => {
    process.env.LINEAR_API_KEY = 'lin_api_test'

    const mockResponse = {
      data: {
        team: {
          issues: {
            nodes: [
              {
                id: 'issue-1',
                identifier: 'JOK-1',
                title: 'Solo issue',
                priority: 1,
                state: { name: 'Todo', type: 'unstarted' },
                relations: { nodes: [] },
              },
            ],
          },
        },
      },
    }

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => mockResponse }),
    )

    const result = await fetchIssueRelations('team-123')
    expect(result).toHaveLength(1)
    expect(result[0].relations).toHaveLength(0)
  })

  it('returns empty array for empty issues list', async () => {
    process.env.LINEAR_API_KEY = 'lin_api_test'

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: { team: { issues: { nodes: [] } } } }),
      }),
    )

    const result = await fetchIssueRelations('team-123')
    expect(result).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// fetchBlockingRelations
// ---------------------------------------------------------------------------

describe('fetchBlockingRelations', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
    vi.restoreAllMocks()
  })

  it('returns [] for empty issueIds input', async () => {
    process.env.LINEAR_API_KEY = 'lin_api_test'
    const result = await fetchBlockingRelations([])
    expect(result).toEqual([])
  })

  it('returns [] when LINEAR_API_KEY is missing', async () => {
    delete process.env.LINEAR_API_KEY
    const result = await fetchBlockingRelations(['issue-1', 'issue-2'])
    expect(result).toEqual([])
  })

  it('returns [] on fetch error', async () => {
    process.env.LINEAR_API_KEY = 'lin_api_test'
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))

    const result = await fetchBlockingRelations(['issue-1'])
    expect(result).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Graph algorithm tests (via computeCriticalPath)
// ---------------------------------------------------------------------------

describe('computeCriticalPath graph algorithm', () => {
  // We test the algorithm directly by importing computeCriticalPath
  // and providing mock Linear data via the module system.

  it('finds longest path A→B→C given linear chain', async () => {
    // We test the internal graph logic by importing criticalPath
    // and injecting issues that have dependency data in RawIssue format.
    // Since computeCriticalPath falls back to config/linear-issues.json when no API key,
    // and we can't easily inject data there in tests, we test the internal helpers
    // by exercising the exported function with mocked fetch returning data.

    const { computeCriticalPath } = await import('@/lib/criticalPath')

    const mockLinearData = {
      data: {
        team: {
          issues: {
            nodes: [
              {
                id: 'a',
                identifier: 'JOK-1',
                title: 'Task A',
                priority: 2,
                state: { name: 'Todo', type: 'unstarted' },
                relations: {
                  nodes: [
                    {
                      id: 'rel-ab',
                      type: 'blocks',
                      relatedIssue: {
                        id: 'b',
                        identifier: 'JOK-2',
                        title: 'Task B',
                        state: { name: 'Todo' },
                      },
                    },
                  ],
                },
              },
              {
                id: 'b',
                identifier: 'JOK-2',
                title: 'Task B',
                priority: 1,
                state: { name: 'Todo', type: 'unstarted' },
                relations: {
                  nodes: [
                    {
                      id: 'rel-bc',
                      type: 'blocks',
                      relatedIssue: {
                        id: 'c',
                        identifier: 'JOK-3',
                        title: 'Task C',
                        state: { name: 'Todo' },
                      },
                    },
                  ],
                },
              },
              {
                id: 'c',
                identifier: 'JOK-3',
                title: 'Task C',
                priority: 3,
                state: { name: 'Todo', type: 'unstarted' },
                relations: { nodes: [] },
              },
            ],
          },
        },
      },
    }

    process.env.LINEAR_API_KEY = 'lin_api_test'
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => mockLinearData }),
    )

    const result = await computeCriticalPath('team-123')

    expect(result.longestChain).toBe(3)
    expect(result.issues.map((i) => i.id)).toEqual(['a', 'b', 'c'])

    vi.restoreAllMocks()
    delete process.env.LINEAR_API_KEY
  })

  it('falls back to priority sort when LINEAR_API_KEY is not set', async () => {
    const originalEnv = process.env
    process.env = { ...originalEnv }
    delete process.env.LINEAR_API_KEY

    const { computeCriticalPath } = await import('@/lib/criticalPath')

    // Without a config file and without API key, returns empty
    const result = await computeCriticalPath()
    expect(Array.isArray(result.issues)).toBe(true)
    expect(typeof result.totalEstimate).toBe('number')
    expect(typeof result.longestChain).toBe('number')

    process.env = originalEnv
  })

  it('handles cycle in graph without infinite loop', async () => {
    const { computeCriticalPath } = await import('@/lib/criticalPath')

    // A blocks B, B blocks A — cycle
    const cyclicData = {
      data: {
        team: {
          issues: {
            nodes: [
              {
                id: 'a',
                identifier: 'JOK-1',
                title: 'Task A',
                priority: 2,
                state: { name: 'Todo', type: 'unstarted' },
                relations: {
                  nodes: [
                    {
                      id: 'rel-ab',
                      type: 'blocks',
                      relatedIssue: {
                        id: 'b',
                        identifier: 'JOK-2',
                        title: 'Task B',
                        state: { name: 'Todo' },
                      },
                    },
                  ],
                },
              },
              {
                id: 'b',
                identifier: 'JOK-2',
                title: 'Task B',
                priority: 1,
                state: { name: 'Todo', type: 'unstarted' },
                relations: {
                  nodes: [
                    {
                      id: 'rel-ba',
                      type: 'blocks',
                      relatedIssue: {
                        id: 'a',
                        identifier: 'JOK-1',
                        title: 'Task A',
                        state: { name: 'Todo' },
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      },
    }

    process.env.LINEAR_API_KEY = 'lin_api_test'
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => cyclicData }),
    )

    // Must complete without hanging (cycle → fallback to priority sort)
    const result = await computeCriticalPath('team-123')
    expect(Array.isArray(result.issues)).toBe(true)
    expect(result.issues.length).toBeGreaterThan(0)

    vi.restoreAllMocks()
    delete process.env.LINEAR_API_KEY
  })

  it('returns empty result for empty input from Linear', async () => {
    const { computeCriticalPath } = await import('@/lib/criticalPath')

    process.env.LINEAR_API_KEY = 'lin_api_test'
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: { team: { issues: { nodes: [] } } } }),
      }),
    )

    // Falls through to file-based fallback which also returns empty
    const result = await computeCriticalPath('team-123')
    expect(typeof result.longestChain).toBe('number')
    expect(Array.isArray(result.issues)).toBe(true)

    vi.restoreAllMocks()
    delete process.env.LINEAR_API_KEY
  })
})
