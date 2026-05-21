import { NextRequest } from 'next/server'
import { describe, it, expect, beforeEach, vi } from 'vitest'

// Bypass auth for unit tests — auth behaviour is tested in require-auth.test.ts
vi.mock('@/lib/auth/require-auth', () => ({ requireAuth: vi.fn().mockResolvedValue(null) }))

import { GET, POST } from './route'

const mockBuiltBrief = {
  id: 'test-id',
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
}

vi.mock('@/lib/project-briefs', () => ({
  readProjectBriefs: vi.fn(() => []),
  buildProjectBrief: vi.fn(() => mockBuiltBrief),
  saveProjectBrief: vi.fn(brief => brief),
  validateIdeaIntakeInput: vi.fn(() => ({})),
  hasIdeaIntakeErrors: vi.fn(() => false),
}))

vi.mock('@/lib/repositories/projectBriefRepository', () => ({
  createProjectBriefRepository: vi.fn(() => ({
    listAll: vi.fn(async () => []),
    create: vi.fn(async (input: typeof mockBuiltBrief) => input),
    findById: vi.fn(async () => null),
    update: vi.fn(async () => null),
    delete: vi.fn(async () => false),
    listByStatus: vi.fn(async () => []),
  })),
}))

function makeReq(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/project-briefs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

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
    const res = await GET(new NextRequest('http://localhost/api/project-briefs'))
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
    const res = await POST(makeReq(validInput))
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data).toHaveProperty('id')
    expect(data).toHaveProperty('title')
  })

  it('returns 400 when validation fails (Zod)', async () => {
    // title too short, rawIdea missing → Zod rejects
    const res = await POST(makeReq({ ...validInput, title: '', rawIdea: '' }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data).toHaveProperty('error', 'Validation failed')
    expect(data).toHaveProperty('fields')
  })
})
