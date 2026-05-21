import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { WorkItem } from '@/lib/models/work-item'

const localItems: WorkItem[] = [
  {
    id: 'local-1',
    source: 'local',
    type: 'ticket',
    title: 'Fix CSV "quotes", now',
    url: '',
    projectId: 'forgepilot',
    status: 'todo',
    priority: 1,
    blocked: false,
    risk: 'A',
    aiDelegable: true,
    createdAt: '2026-05-01T10:00:00.000Z',
    updatedAt: '2026-05-02T10:00:00.000Z',
  },
]

const linearItems: WorkItem[] = [
  {
    id: 'LIN-1',
    source: 'linear',
    type: 'ticket',
    title: 'Linear task',
    url: 'https://linear.app/test/LIN-1',
    projectId: 'forgepilot',
    status: 'done',
    priority: 2,
    blocked: false,
    risk: 'B',
    aiDelegable: true,
    createdAt: '2026-05-01T10:00:00.000Z',
    updatedAt: '2026-05-03T10:00:00.000Z',
  },
]

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(() => true),
    readFileSync: vi.fn(() => JSON.stringify(localItems)),
  },
}))

vi.mock('@/lib/connectors/config', () => ({
  readConnectorConfigs: vi.fn(() => ({ linear: {}, github: {} })),
}))

vi.mock('@/lib/connectors/linear-items', () => ({
  fetchLinearWorkItems: vi.fn(async () => linearItems),
}))

vi.mock('@/lib/connectors/github-items', () => ({
  fetchGitHubWorkItems: vi.fn(async () => []),
}))

vi.mock('@/lib/connectors/sync', () => ({
  readCachedWorkItems: vi.fn(() => ({
    syncedAt: '2026-05-01T00:00:00.000Z',
    durationMs: 10,
    results: [],
    items: linearItems,
  })),
}))

import { GET } from './route'

function makeRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost/api/work-items/export')
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  return new NextRequest(url.toString())
}

describe('GET /api/work-items/export', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns CSV with download headers', async () => {
    const res = await GET(makeRequest({ source: 'local' }))
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('text/csv')
    expect(res.headers.get('Content-Disposition')).toContain('work-items-export')
  })

  it('exports the expected CSV columns', async () => {
    const res = await GET(makeRequest({ source: 'local' }))
    const text = await res.text()
    expect(text.split('\n')[0]).toBe('id,source,type,title,status,priority,risk,blocked,projectId,milestone,assigneeName,url,updatedAt,createdAt')
  })

  it('escapes commas and quotes in CSV fields', async () => {
    const res = await GET(makeRequest({ source: 'local' }))
    const text = await res.text()
    expect(text).toContain('"Fix CSV ""quotes"", now"')
  })

  it('filters by source and status', async () => {
    const res = await GET(makeRequest({ source: 'linear', status: 'done' }))
    const text = await res.text()
    expect(text).toContain('LIN-1')
    expect(text).not.toContain('local-1')
  })

  it('uses cached connector data when cached=1', async () => {
    const res = await GET(makeRequest({ cached: '1', source: 'linear' }))
    const text = await res.text()
    expect(text).toContain('LIN-1')
    expect(text).not.toContain('local-1')
  })

  it('returns 400 for invalid filters', async () => {
    const sourceRes = await GET(makeRequest({ source: 'jira' }))
    expect(sourceRes.status).toBe(400)

    const statusRes = await GET(makeRequest({ status: 'blocked' }))
    expect(statusRes.status).toBe(400)
  })
})
