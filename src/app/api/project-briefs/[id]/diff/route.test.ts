import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from './route'
import type { ProjectBrief } from '@/lib/models/project-brief'

const baseBrief: ProjectBrief = {
  id: 'brief-1',
  title: 'Current title',
  status: 'in_review',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-03T00:00:00.000Z',
  rawIdea: 'Current idea',
  problemStatement: 'Current problem',
  targetAudience: 'Builders',
  desiredOutcome: 'Shipped product',
  constraints: [],
  scope: 'standard',
  researchMode: 'standard',
  privacyMode: 'local',
  requirements: [],
  useCases: [],
  nonGoals: [],
  risks: [],
  researchRunIds: [],
  researchBriefDraft: {
    title: 'Research',
    mode: 'standard',
    privacyMode: 'local',
    preferredExecutor: 'agent',
    researchQuestions: [],
    searchTerms: [],
    preferredSourceTypes: [],
    excludeCriteria: [],
  },
}

const versionOne = {
  versionId: 'v1',
  briefId: 'brief-1',
  versionNumber: 1,
  savedAt: '2026-01-01T12:00:00.000Z',
  label: 'Initial',
  snapshot: { ...baseBrief, title: 'Old title', updatedAt: '2026-01-01T00:00:00.000Z' },
}

vi.mock('@/lib/project-briefs', () => ({
  findProjectBriefById: vi.fn((id: string) => id === 'brief-1' ? baseBrief : undefined),
}))

vi.mock('@/lib/project-briefs/brief-versions', () => ({
  getBriefVersions: vi.fn(() => [versionOne]),
  getBriefVersion: vi.fn((briefId: string, versionId: string) =>
    briefId === 'brief-1' && versionId === 'v1' ? versionOne : null
  ),
  diffBriefs: vi.fn((before: ProjectBrief, after: ProjectBrief) => [
    { field: 'title', label: 'Titel', before: before.title, after: after.title, changed: before.title !== after.title },
  ]),
}))

const makeParams = (id: string) => ({ params: Promise.resolve({ id }) })

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/project-briefs/[id]/diff', () => {
  it('compares the selected version with the current brief', async () => {
    const res = await GET(new NextRequest('http://localhost/api/project-briefs/brief-1/diff?v1=v1'), makeParams('brief-1'))
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.before).toMatchObject({ versionId: 'v1', versionNumber: 1, label: 'Initial' })
    expect(data.after).toMatchObject({ versionId: 'current', label: 'Aktueller Stand' })
    expect(data.changedCount).toBe(1)
    expect(data.diffs[0]).toMatchObject({ field: 'title', before: 'Old title', after: 'Current title' })
  })

  it('returns 404 for an unknown brief', async () => {
    const res = await GET(new NextRequest('http://localhost/api/project-briefs/nope/diff'), makeParams('nope'))
    expect(res.status).toBe(404)
  })

  it('returns 404 when the requested before version does not exist', async () => {
    const res = await GET(new NextRequest('http://localhost/api/project-briefs/brief-1/diff?v1=missing'), makeParams('brief-1'))
    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({ error: 'Version v1 not found.' })
  })
})
