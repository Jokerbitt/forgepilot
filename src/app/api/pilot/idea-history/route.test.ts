import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { IdeaHistoryEntry } from '@/lib/pilot/idea-history-store'

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockReadIdeaHistory = vi.fn((): IdeaHistoryEntry[] => [])
vi.mock('@/lib/pilot/idea-history-store', () => ({
  readIdeaHistory: mockReadIdeaHistory,
}))

const mockGetRun = vi.fn()
vi.mock('@/lib/agents/orchestrated-run', () => ({
  getRun: mockGetRun,
}))

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeEntry(overrides: Partial<IdeaHistoryEntry> = {}): IdeaHistoryEntry {
  return {
    id: 'entry-1',
    idea: 'Build a Slack bot',
    briefId: 'brief-1',
    briefTitle: 'Slack Daily Bot',
    runId: 'run-1',
    workItemCount: 3,
    taskCount: 5,
    status: 'building',
    createdAt: '2026-05-19T00:00:00Z',
    ...overrides,
  }
}

function makeReq(params = ''): Request {
  return new Request(`http://localhost/api/pilot/idea-history${params}`)
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('GET /api/pilot/idea-history', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockGetRun.mockReturnValue(null)
  })

  it('returns empty array when no history', async () => {
    mockReadIdeaHistory.mockReturnValue([])
    vi.resetModules()
    const { GET } = await import('./route')
    const res = await GET(makeReq())
    expect(res.status).toBe(200)
    const data = await res.json() as unknown[]
    expect(data).toEqual([])
  })

  it('defaults to limit=5', async () => {
    mockReadIdeaHistory.mockReturnValue([makeEntry()])
    vi.resetModules()
    const { GET } = await import('./route')
    await GET(makeReq())
    expect(mockReadIdeaHistory).toHaveBeenCalledWith(5)
  })

  it('respects custom limit param', async () => {
    mockReadIdeaHistory.mockReturnValue([makeEntry()])
    vi.resetModules()
    const { GET } = await import('./route')
    await GET(makeReq('?limit=10'))
    expect(mockReadIdeaHistory).toHaveBeenCalledWith(10)
  })

  it('caps limit at 20', async () => {
    mockReadIdeaHistory.mockReturnValue([makeEntry()])
    vi.resetModules()
    const { GET } = await import('./route')
    await GET(makeReq('?limit=999'))
    expect(mockReadIdeaHistory).toHaveBeenCalledWith(20)
  })

  it('enriches status from live run — done', async () => {
    mockReadIdeaHistory.mockReturnValue([makeEntry({ runId: 'run-abc', status: 'building' })])
    mockGetRun.mockReturnValue({ status: 'done' })
    vi.resetModules()
    const { GET } = await import('./route')
    const res = await GET(makeReq())
    const data = await res.json() as Array<{ status: string }>
    expect(data[0].status).toBe('done')
  })

  it('enriches status from live run — running', async () => {
    mockReadIdeaHistory.mockReturnValue([makeEntry({ status: 'building' })])
    mockGetRun.mockReturnValue({ status: 'running' })
    vi.resetModules()
    const { GET } = await import('./route')
    const res = await GET(makeReq())
    const data = await res.json() as Array<{ status: string }>
    expect(data[0].status).toBe('running')
  })

  it('enriches status from live run — failed on aborted', async () => {
    mockReadIdeaHistory.mockReturnValue([makeEntry({ status: 'running' })])
    mockGetRun.mockReturnValue({ status: 'aborted' })
    vi.resetModules()
    const { GET } = await import('./route')
    const res = await GET(makeReq())
    const data = await res.json() as Array<{ status: string }>
    expect(data[0].status).toBe('failed')
  })

  it('falls back to stored status when run not found', async () => {
    mockReadIdeaHistory.mockReturnValue([makeEntry({ status: 'done' })])
    mockGetRun.mockReturnValue(null)
    vi.resetModules()
    const { GET } = await import('./route')
    const res = await GET(makeReq())
    const data = await res.json() as Array<{ status: string }>
    expect(data[0].status).toBe('done')
  })

  it('returns all entry fields unchanged', async () => {
    const entry = makeEntry({ briefTitle: 'My Project', workItemCount: 7 })
    mockReadIdeaHistory.mockReturnValue([entry])
    vi.resetModules()
    const { GET } = await import('./route')
    const res = await GET(makeReq())
    const data = await res.json() as IdeaHistoryEntry[]
    expect(data[0].briefTitle).toBe('My Project')
    expect(data[0].workItemCount).toBe(7)
    expect(data[0].idea).toBe(entry.idea)
  })
})
