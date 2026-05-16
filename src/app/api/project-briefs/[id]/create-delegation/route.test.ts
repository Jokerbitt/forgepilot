import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from './route'

const mockAcceptedBrief = {
  id: 'brief-001',
  title: 'Neues Feature',
  status: 'accepted' as const,
  createdAt: '2026-05-16T00:00:00Z',
  updatedAt: '2026-05-16T00:00:00Z',
  rawIdea: 'Eine tolle Idee für ein neues Feature',
  problemStatement: 'Das Problem ist ungelöst',
  targetAudience: 'Entwickler',
  desiredOutcome: 'Ein funktionierendes System',
  constraints: ['Budget: 5k', 'Deadline: Q3'],
  nonGoals: ['Mobile App'],
  scope: 'standard' as const,
  researchMode: 'standard' as const,
  privacyMode: 'local' as const,
  requirements: [
    { id: 'r1', briefId: 'brief-001', type: 'functional' as const, title: 'Login funktioniert', description: '', priority: 'must' as const, source: 'user_input' as const, findingIds: [], status: 'accepted' as const },
    { id: 'r2', briefId: 'brief-001', type: 'functional' as const, title: 'API rate-limited', description: '', priority: 'should' as const, source: 'ai_proposed' as const, findingIds: [], status: 'rejected' as const },
  ],
  useCases: [],
  risks: [],
  researchRunIds: [],
  researchBriefDraft: {
    title: 'Research Brief',
    mode: 'standard' as const,
    privacyMode: 'local' as const,
    preferredExecutor: 'agent' as const,
    researchQuestions: [],
    searchTerms: [],
    preferredSourceTypes: [],
    excludeCriteria: [],
  },
}

const mockDraftBrief = { ...mockAcceptedBrief, id: 'brief-002', status: 'draft' as const }

vi.mock('@/lib/project-briefs', () => ({
  findProjectBriefById: vi.fn((id: string) => {
    if (id === 'brief-001') return mockAcceptedBrief
    if (id === 'brief-002') return mockDraftBrief
    return undefined
  }),
}))

vi.mock('fs', () => ({
  default: {
    readFileSync: vi.fn(() => '[]'),
    writeFileSync: vi.fn(),
    renameSync: vi.fn(),
    existsSync: vi.fn(() => true),
    mkdirSync: vi.fn(),
  },
}))

const makeParams = (id: string) => ({ params: { id } })

describe('POST /api/project-briefs/[id]/create-delegation', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('creates delegation from accepted brief', async () => {
    const res = await POST(new Request('http://localhost', { method: 'POST' }), makeParams('brief-001'))
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data).toHaveProperty('id')
    expect(data.contract.goal).toBe('Ein funktionierendes System')
    expect(data.contract.workItemId).toMatch(/^BRIEF-/)
    expect(data.contract.definitionOfDone).toContain('Login funktioniert')
    // rejected requirement should NOT be in DoD
    expect(data.contract.definitionOfDone).not.toContain('API rate-limited')
    expect(data.status).toBe('pending')
    expect(data.contract.privacyMode).toBe('local')
  })

  it('returns 422 when brief is not accepted', async () => {
    const res = await POST(new Request('http://localhost', { method: 'POST' }), makeParams('brief-002'))
    expect(res.status).toBe(422)
  })

  it('returns 404 when brief not found', async () => {
    const res = await POST(new Request('http://localhost', { method: 'POST' }), makeParams('not-found'))
    expect(res.status).toBe(404)
  })
})
