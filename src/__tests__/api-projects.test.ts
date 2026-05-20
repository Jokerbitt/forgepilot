/**
 * Tests for GET /api/projects
 *
 * Mocks filesystem-dependent imports so no real I/O is needed.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ProjectBrief } from '@/lib/models/project-brief'
import type { IdeaHistoryEntry } from '@/lib/pilot/idea-history-store'
import type { OrchestratedRun } from '@/lib/agents/orchestrated-run'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const MOCK_BRIEF: ProjectBrief = {
  id: 'brief-1',
  title: 'Test Project',
  problemStatement: 'Needs solving',
  createdAt: '2026-05-01T10:00:00.000Z',
} as ProjectBrief

const MOCK_HISTORY_ENTRY: IdeaHistoryEntry = {
  briefId: 'brief-1',
  idea: 'Great idea',
  runId: 'run-abc',
  status: 'done',
  workItemCount: 5,
  taskCount: 10,
  createdAt: '2026-05-01T10:00:00.000Z',
} as IdeaHistoryEntry

const MOCK_RUN: OrchestratedRun = {
  id: 'run-abc',
  status: 'done',
  tasks: [
    { status: 'done' } as OrchestratedRun['tasks'][0],
    { status: 'done' } as OrchestratedRun['tasks'][0],
    { status: 'running' } as OrchestratedRun['tasks'][0],
  ],
} as OrchestratedRun

// ─── Mocks (must come before route import) ────────────────────────────────────

vi.mock('@/lib/project-briefs', () => ({
  readProjectBriefs: vi.fn(() => [MOCK_BRIEF]),
}))

vi.mock('@/lib/pilot/idea-history-store', () => ({
  readIdeaHistory: vi.fn(() => [MOCK_HISTORY_ENTRY]),
}))

vi.mock('@/lib/agents/orchestrated-run', () => ({
  getRun: vi.fn(() => MOCK_RUN),
}))

// ─── Imports after mocks ──────────────────────────────────────────────────────

import { readProjectBriefs } from '@/lib/project-briefs'
import { readIdeaHistory } from '@/lib/pilot/idea-history-store'
import { getRun } from '@/lib/agents/orchestrated-run'
import { GET } from '@/app/api/projects/route'
import type { ProjectSummary } from '@/app/api/projects/route'

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/projects', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(readProjectBriefs).mockReturnValue([MOCK_BRIEF])
    vi.mocked(readIdeaHistory).mockReturnValue([MOCK_HISTORY_ENTRY])
    vi.mocked(getRun).mockReturnValue(MOCK_RUN)
  })

  it('returns HTTP 200', async () => {
    const response = await GET()
    expect(response.status).toBe(200)
  })

  it('returns an array in the response body', async () => {
    const response = await GET()
    const body = await response.json() as ProjectSummary[]
    expect(Array.isArray(body)).toBe(true)
  })

  it('includes the project id and title from the brief', async () => {
    const response = await GET()
    const body = await response.json() as ProjectSummary[]
    expect(body).toHaveLength(1)
    expect(body[0].id).toBe('brief-1')
    expect(body[0].title).toBe('Test Project')
  })

  it('enriches project with pipeline data when history entry exists', async () => {
    const response = await GET()
    const body = await response.json() as ProjectSummary[]
    const project = body[0]
    expect(project.pipeline).toBeDefined()
    expect(project.pipeline?.runId).toBe('run-abc')
    expect(project.pipeline?.idea).toBe('Great idea')
  })

  it('sets runStatus to done when run is done', async () => {
    const response = await GET()
    const body = await response.json() as ProjectSummary[]
    expect(body[0].pipeline?.runStatus).toBe('done')
  })

  it('counts doneTasks correctly from live run', async () => {
    const response = await GET()
    const body = await response.json() as ProjectSummary[]
    // 2 of 3 mock tasks have status 'done'
    expect(body[0].pipeline?.doneTasks).toBe(2)
  })

  it('returns project without pipeline when no history entry matches', async () => {
    vi.mocked(readIdeaHistory).mockReturnValue([])
    const response = await GET()
    const body = await response.json() as ProjectSummary[]
    expect(body[0].pipeline).toBeUndefined()
  })

  it('falls back to entry.status when no live run is found', async () => {
    vi.mocked(getRun).mockReturnValue(undefined)
    const response = await GET()
    const body = await response.json() as ProjectSummary[]
    expect(body[0].pipeline?.runStatus).toBe('done') // matches MOCK_HISTORY_ENTRY.status
  })

  it('returns empty array when there are no briefs', async () => {
    vi.mocked(readProjectBriefs).mockReturnValue([])
    const response = await GET()
    const body = await response.json() as ProjectSummary[]
    expect(body).toEqual([])
  })

  it('returns Content-Type application/json', async () => {
    const response = await GET()
    expect(response.headers.get('content-type')).toContain('application/json')
  })
})
