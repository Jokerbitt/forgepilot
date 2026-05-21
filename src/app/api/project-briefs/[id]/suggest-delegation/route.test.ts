import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from './route'

const makeParams = (id: string) => ({ params: Promise.resolve({ id }) })

const makeAcceptedBrief = (overrides?: Record<string, unknown>) => ({
  id: 'brief-abc123def456',
  title: 'Test Brief Title',
  status: 'accepted' as const,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  rawIdea: 'Raw idea text',
  problemStatement: 'The core problem we need to solve',
  targetAudience: 'Developers',
  desiredOutcome: 'A working delegation pipeline',
  constraints: [],
  scope: 'standard' as const,
  researchMode: 'standard' as const,
  privacyMode: 'local' as const,
  requirements: [],
  useCases: [],
  nonGoals: [],
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
  ...overrides,
})

const mockRepo = {
  findById: vi.fn(),
  listAll: vi.fn(async () => []),
  listByStatus: vi.fn(async () => []),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}

vi.mock('@/lib/repositories/projectBriefRepository', () => ({
  createProjectBriefRepository: vi.fn(() => mockRepo),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/project-briefs/[id]/suggest-delegation', () => {
  it('returns 404 when brief is not found', async () => {
    mockRepo.findById.mockResolvedValue(null)
    const res = await GET(new Request('http://localhost'), makeParams('missing-id'))
    expect(res.status).toBe(404)
    const body = await res.json() as { error: string }
    expect(body.error).toBeTruthy()
  })

  it('returns 409 when brief status is not accepted', async () => {
    const draftBrief = makeAcceptedBrief({ status: 'draft' })
    mockRepo.findById.mockResolvedValue(draftBrief)
    const res = await GET(new Request('http://localhost'), makeParams('brief-abc123def456'))
    expect(res.status).toBe(409)
    const body = await res.json() as { error: string }
    expect(body.error).toBeTruthy()
  })

  it('returns a suggested contract for an accepted brief', async () => {
    const brief = makeAcceptedBrief()
    mockRepo.findById.mockResolvedValue(brief)
    const res = await GET(new Request('http://localhost'), makeParams('brief-abc123def456'))
    expect(res.status).toBe(200)
    const body = await res.json() as { contract: Record<string, unknown> }
    expect(body.contract).toBeDefined()
    expect(body.contract.goal).toBe('A working delegation pipeline')
    expect(body.contract.workItemId).toBe('BRIEF-BRIEF-AB')
    expect(body.contract.riskClass).toBe('A')
    expect(body.contract.maxBudgetUsd).toBe(1)
    expect(body.contract.branchStrategy).toBe('feature')
    expect(body.contract.requiresApproval).toBe(false)
    expect(body.contract.privacyMode).toBe('local')
    expect(body.contract.taskType).toBe('feature')
  })

  it('sets riskClass B and requiresApproval true when brief has risks', async () => {
    const brief = makeAcceptedBrief({
      risks: [
        {
          id: 'risk-1',
          briefId: 'brief-abc123def456',
          title: 'Security risk',
          description: 'Could expose data',
          probability: 'medium',
          impact: 'high',
          isOpenAssumption: false,
          findingIds: [],
        },
      ],
    })
    mockRepo.findById.mockResolvedValue(brief)
    const res = await GET(new Request('http://localhost'), makeParams('brief-abc123def456'))
    expect(res.status).toBe(200)
    const body = await res.json() as { contract: Record<string, unknown> }
    expect(body.contract.riskClass).toBe('B')
    expect(body.contract.requiresApproval).toBe(true)
  })

  it('uses brief title as goal when desiredOutcome is empty', async () => {
    const brief = makeAcceptedBrief({ desiredOutcome: '' })
    mockRepo.findById.mockResolvedValue(brief)
    const res = await GET(new Request('http://localhost'), makeParams('brief-abc123def456'))
    expect(res.status).toBe(200)
    const body = await res.json() as { contract: Record<string, unknown> }
    expect(body.contract.goal).toBe('Test Brief Title')
  })

  it('uses accepted requirements for definitionOfDone', async () => {
    const brief = makeAcceptedBrief({
      requirements: [
        {
          id: 'req-1',
          briefId: 'brief-abc123def456',
          type: 'functional',
          title: 'Accepted requirement',
          description: 'desc',
          priority: 'must',
          source: 'user_input',
          findingIds: [],
          status: 'accepted',
        },
        {
          id: 'req-2',
          briefId: 'brief-abc123def456',
          type: 'functional',
          title: 'Proposed requirement',
          description: 'desc',
          priority: 'should',
          source: 'user_input',
          findingIds: [],
          status: 'proposed',
        },
      ],
    })
    mockRepo.findById.mockResolvedValue(brief)
    const res = await GET(new Request('http://localhost'), makeParams('brief-abc123def456'))
    expect(res.status).toBe(200)
    const body = await res.json() as { contract: { definitionOfDone: string[] } }
    expect(body.contract.definitionOfDone).toEqual(['Accepted requirement'])
  })
})
