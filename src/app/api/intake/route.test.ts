import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'
import { POST } from './route'

const mockBrief = {
  id: 'intake-test-id',
  title: 'Test Project',
  status: 'in_review',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  rawIdea: 'Eine ausreichend lange Beschreibung der Idee',
  problemStatement: 'Das konkrete Problem wird hier beschrieben',
  targetAudience: 'Entwickler',
  desiredOutcome: 'Eine funktionierende Lösung für das Problem',
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
  buildProjectBrief: vi.fn(() => mockBrief),
  saveProjectBrief: vi.fn(brief => brief),
  validateIdeaIntakeInput: vi.fn(() => ({})),
  hasIdeaIntakeErrors: vi.fn(() => false),
  splitConstraintLines: vi.fn((s: string) => s.split(',').map((x: string) => x.trim()).filter(Boolean)),
}))

const validPayload = {
  title: 'Test Project',
  rawIdea: 'Eine ausreichend lange Beschreibung der Idee',
  problemStatement: 'Das konkrete Problem wird hier beschrieben',
  targetAudience: 'Entwickler',
  desiredOutcome: 'Eine funktionierende Lösung für das Problem',
  scope: 'standard',
  researchMode: 'standard',
  privacyMode: 'local',
}

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/intake', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as NextRequest
}

describe('POST /api/intake', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('creates and returns a brief with 201 for valid payload', async () => {
    const res = await POST(makeRequest(validPayload))
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data).toHaveProperty('id', 'intake-test-id')
    expect(data).toHaveProperty('title', 'Test Project')
  })

  it('accepts snake_case field aliases', async () => {
    const { buildProjectBrief } = await import('@/lib/project-briefs')
    const res = await POST(makeRequest({
      title: 'Snake Case Project',
      raw_idea: 'Eine ausreichend lange Beschreibung der Idee',
      problem_statement: 'Das konkrete Problem wird hier beschrieben',
      target_audience: 'Entwickler',
      desired_outcome: 'Eine funktionierende Lösung für das Problem',
    }))
    expect(res.status).toBe(201)
    const calls = vi.mocked(buildProjectBrief).mock.calls
    expect(calls[0][0]).toMatchObject({
      rawIdea: 'Eine ausreichend lange Beschreibung der Idee',
      problemStatement: 'Das konkrete Problem wird hier beschrieben',
    })
  })

  it('returns 400 when validation fails (Zod schema rejects body)', async () => {
    // Zod IntakeWebhookBodySchema requires at least one of rawIdea/raw_idea/idea.
    // Pass an empty object — no idea field present → schema .refine() fails → 400.
    const res = await POST(makeRequest({ title: '', scope: 'undefined' }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data).toHaveProperty('error', 'Validation failed')
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = new Request('http://localhost/api/intake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-valid-json',
    }) as unknown as NextRequest
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('converts string constraints to array', async () => {
    const { buildProjectBrief, splitConstraintLines } = await import('@/lib/project-briefs')
    vi.mocked(splitConstraintLines).mockReturnValueOnce(['TypeScript', 'No auth'])
    await POST(makeRequest({ ...validPayload, constraints: 'TypeScript, No auth' }))
    const input = vi.mocked(buildProjectBrief).mock.calls[0][0]
    expect(Array.isArray(input.constraints)).toBe(true)
  })
})
