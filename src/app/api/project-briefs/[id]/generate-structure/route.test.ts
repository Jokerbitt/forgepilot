import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from './route'
import * as projectBriefs from '@/lib/project-briefs'
import * as textGeneration from '@/lib/ai/text-generation'

vi.mock('@/lib/project-briefs')
vi.mock('@/lib/ai/text-generation', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/ai/text-generation')>()
  return { ...original, generateText: vi.fn() }
})

const mockBrief = {
  id: 'brief-studio-test',
  title: 'KI Rechercheassistent',
  status: 'in_review' as const,
  createdAt: '2026-05-22T00:00:00Z',
  updatedAt: '2026-05-22T00:00:00Z',
  rawIdea: 'Ein KI-gestützter Assistent der Projektideen strukturiert und validiert.',
  problemStatement: 'Projektideen bleiben zu lange unstrukturiert und werden nicht validiert.',
  targetAudience: 'Solo-Developer und kleine Teams',
  desiredOutcome: 'Aus einer losen Idee wird in Minuten ein strukturierter ProjectBrief.',
  constraints: ['local-first', 'kein Cloud-Zwang'],
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
}

const makeRequest = () => new Request('http://localhost', { method: 'POST' })
const makeParams = (id: string) => ({ params: Promise.resolve({ id }) })

describe('POST /api/project-briefs/[id]/generate-structure', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(projectBriefs.findProjectBriefById).mockImplementation(
      (id: string) => id === 'brief-studio-test' ? mockBrief : undefined
    )
    vi.mocked(projectBriefs.updateProjectBrief).mockImplementation(
      (id: string, patch) =>
        id === 'brief-studio-test' ? { ...mockBrief, ...patch } as ReturnType<typeof projectBriefs.updateProjectBrief> : null
    )
  })

  it('returns 404 when brief is not found', async () => {
    const res = await POST(makeRequest(), makeParams('does-not-exist'))
    expect(res.status).toBe(404)
    const body = await res.json() as { error: string }
    expect(body.error).toContain('not found')
  })

  it('returns no_ai_provider error when AI provider is not configured', async () => {
    vi.mocked(textGeneration.generateText).mockRejectedValueOnce(
      new textGeneration.AIProviderConfigurationError('No API key configured')
    )

    const res = await POST(makeRequest(), makeParams('brief-studio-test'))
    expect(res.status).toBe(503)

    const body = await res.json() as {
      error: string
      message: string
      settingsUrl: string
    }
    expect(body.error).toBe('no_ai_provider')
    expect(typeof body.message).toBe('string')
    expect(body.message.length).toBeGreaterThan(0)
    expect(body.settingsUrl).toBe('/settings')
  })

  it('does not call updateProjectBrief when AI provider is not configured', async () => {
    vi.mocked(textGeneration.generateText).mockRejectedValueOnce(
      new textGeneration.AIProviderConfigurationError('No API key configured')
    )

    await POST(makeRequest(), makeParams('brief-studio-test'))

    expect(projectBriefs.updateProjectBrief).not.toHaveBeenCalled()
  })

  it('returns error and settingsUrl fields in the no_ai_provider response', async () => {
    vi.mocked(textGeneration.generateText).mockRejectedValueOnce(
      new textGeneration.AIProviderConfigurationError('No API key')
    )

    const res = await POST(makeRequest(), makeParams('brief-studio-test'))
    const body = await res.json() as Record<string, unknown>

    expect(body).toHaveProperty('error', 'no_ai_provider')
    expect(body).toHaveProperty('message')
    expect(body).toHaveProperty('settingsUrl')
  })

  it('returns 200 with ai source when generateText succeeds', async () => {
    vi.mocked(textGeneration.generateText).mockResolvedValueOnce({
      text: JSON.stringify({
        requirements: [
          { title: 'Kernfunktion', description: 'Muss funktionieren', type: 'functional', priority: 'must' },
        ],
        useCases: [
          { title: 'Hauptfall', actor: 'Nutzer', trigger: 'Öffnet App', mainFlow: ['Schritt 1', 'Schritt 2'] },
        ],
        risks: [
          { title: 'Risiko 1', description: 'Beschreibung', probability: 'low', impact: 'medium', mitigationIdea: 'Plan B', isOpenAssumption: false },
        ],
        assumptions: ['Annahme 1', 'Annahme 2'],
        implementationDirection: 'MVP-Ansatz mit iterativer Validierung.',
      }),
      provider: 'anthropic',
      model: 'claude-haiku-4-5',
    })

    const res = await POST(makeRequest(), makeParams('brief-studio-test'))
    expect(res.status).toBe(200)

    const body = await res.json() as {
      source: string
      requirements: unknown[]
      assumptions: string[]
      implementationDirection: string
    }
    expect(body.source).toBe('ai')
    expect(body.requirements).toHaveLength(1)
    expect(body.assumptions).toEqual(['Annahme 1', 'Annahme 2'])
    expect(body.implementationDirection).toBe('MVP-Ansatz mit iterativer Validierung.')
  })
})
