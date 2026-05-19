import { NextRequest } from 'next/server'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BRIEF_TEMPLATES } from '@/lib/project-briefs/templates'
import type { BriefTemplate } from '@/lib/project-briefs/templates'

// ---------------------------------------------------------------------------
// Unit tests — template definitions
// ---------------------------------------------------------------------------

describe('BRIEF_TEMPLATES', () => {
  it('contains exactly 3 templates', () => {
    expect(BRIEF_TEMPLATES).toHaveLength(3)
  })

  it('all templates have the required fields', () => {
    const requiredIds: BriefTemplate['id'][] = ['saas', 'mobile', 'rest-api']

    for (const template of BRIEF_TEMPLATES) {
      expect(requiredIds).toContain(template.id)
      expect(template.name).toBeTruthy()
      expect(template.emoji).toBeTruthy()
      expect(template.description).toBeTruthy()
      expect(template.brief.title).toBeTruthy()
      expect(template.brief.problemStatement).toBeTruthy()
      expect(template.brief.targetUsers).toBeTruthy()
      expect(template.brief.coreFeatures.length).toBeGreaterThan(0)
      expect(template.brief.techStack.length).toBeGreaterThan(0)
      expect(template.brief.successMetrics.length).toBeGreaterThan(0)
    }
  })

  it('template ids are unique', () => {
    const ids = BRIEF_TEMPLATES.map(t => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

// ---------------------------------------------------------------------------
// Integration tests — POST /api/project-briefs/from-template
// ---------------------------------------------------------------------------

const mockBrief = {
  id: 'mock-brief-id',
  title: 'Neues SaaS-Produkt',
  status: 'in_review' as const,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  rawIdea: 'SaaS Product: Teams verlieren Zeit durch manuelle Prozesse.',
  problemStatement: 'Teams verlieren Zeit durch manuelle, repetitive Prozesse die automatisiert werden könnten.',
  targetAudience: 'Small Business Owner, 10-50 Mitarbeiter, wenig Tech-Expertise',
  desiredOutcome: '100 zahlende Kunden in 3 Monaten. NPS > 50. Churn < 5%/Monat',
  constraints: ['Next.js 14', 'PostgreSQL', 'Stripe', 'Resend', 'Vercel'],
  scope: 'standard' as const,
  researchMode: 'standard' as const,
  privacyMode: 'local' as const,
  requirements: [],
  useCases: [],
  nonGoals: [],
  risks: [],
  researchRunIds: [],
  researchBriefDraft: {
    title: 'Research Brief: Neues SaaS-Produkt',
    mode: 'standard' as const,
    privacyMode: 'local' as const,
    preferredExecutor: 'agent' as const,
    researchQuestions: [],
    searchTerms: [],
    preferredSourceTypes: [] as string[],
    excludeCriteria: [],
  },
}

vi.mock('@/lib/project-briefs', () => ({
  buildProjectBrief: vi.fn(() => mockBrief),
  saveProjectBrief: vi.fn(brief => brief),
}))

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/project-briefs/from-template', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/project-briefs/from-template', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a brief from a valid templateId (saas)', async () => {
    const { POST } = await import('@/app/api/project-briefs/from-template/route')
    const res = await POST(makeRequest({ templateId: 'saas' }))

    expect(res.status).toBe(201)
    const data = await res.json() as { id: string; redirectUrl: string }
    expect(data.id).toBe('mock-brief-id')
    expect(data.redirectUrl).toBe('/project-briefs/mock-brief-id')
  })

  it('returns 400 for an invalid templateId', async () => {
    const { POST } = await import('@/app/api/project-briefs/from-template/route')
    const res = await POST(makeRequest({ templateId: 'invalid-template' }))

    expect(res.status).toBe(400)
    const data = await res.json() as { error: string }
    expect(data.error).toBeTruthy()
  })
})
