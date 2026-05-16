import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET, POST } from './route'

vi.mock('@/lib/project-briefs', () => ({
  readProjectBriefs: vi.fn(() => []),
  buildProjectBrief: vi.fn((_input, _now, id) => ({
    id: id ?? 'test-id',
    title: 'Test',
    status: 'in_review',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    rawIdea: 'Test idea that is long enough',
    problemStatement: 'Test problem statement',
    targetAudience: 'Developers',
    desiredOutcome: 'A working solution',
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
      title: 'Research Brief: Test',
      mode: 'standard',
      privacyMode: 'local',
      preferredExecutor: 'agent',
      researchQuestions: [],
      searchTerms: [],
      preferredSourceTypes: [],
      excludeCriteria: [],
    },
  })),
  saveProjectBrief: vi.fn(brief => brief),
  validateIdeaIntakeInput: vi.fn(() => ({})),
  hasIdeaIntakeErrors: vi.fn(() => false),
}))

const validInput = {
  title: 'Test Project',
  rawIdea: 'This is a raw idea that is long enough to pass validation',
  problemStatement: 'The problem we are solving',
  targetAudience: 'Developers',
  desiredOutcome: 'A working product that solves the problem',
  constraints: [],
  scope: 'standard',
  researchMode: 'standard',
  privacyMode: 'local',
}

describe('GET /api/project-briefs', () => {
  it('returns an array', async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data)).toBe(true)
  })
})

describe('POST /api/project-briefs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a brief with valid input', async () => {
    const req = new Request('http://localhost/api/project-briefs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validInput),
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data).toHaveProperty('id')
    expect(data).toHaveProperty('title')
  })

  it('returns 400 when validation fails', async () => {
    const { hasIdeaIntakeErrors, validateIdeaIntakeInput } = await import('@/lib/project-briefs')
    vi.mocked(validateIdeaIntakeInput).mockReturnValueOnce({ title: 'Pflichtfeld' })
    vi.mocked(hasIdeaIntakeErrors).mockReturnValueOnce(true)

    const req = new Request('http://localhost/api/project-briefs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validInput, title: '' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data).toHaveProperty('errors')
  })
})
