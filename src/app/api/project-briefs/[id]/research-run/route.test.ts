import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST, GET } from './route'

const testData = vi.hoisted(() => {
  const mockBrief = {
    id: 'brief-rr-1',
    title: 'KI Workflow Tool',
    status: 'in_review' as const,
    createdAt: '2026-05-17T00:00:00Z',
    updatedAt: '2026-05-17T00:00:00Z',
    rawIdea: 'Ein KI-gestuetztes Workflow-Tool fuer Entwickler',
    problemStatement: 'Entwickler verbringen zu viel Zeit mit manueller Planung',
    targetAudience: 'Solo-Entwickler',
    desiredOutcome: 'Automatische Projektplanung aus Ideen',
    constraints: ['local-first', 'kein Cloud-Zwang'],
    scope: 'standard' as const,
    researchMode: 'quick' as const,
    privacyMode: 'local' as const,
    requirements: [],
    useCases: [],
    nonGoals: [],
    risks: [],
    researchRunIds: [],
    researchBriefDraft: {
      title: 'Research Brief: KI Workflow Tool',
      mode: 'quick' as const,
      privacyMode: 'local' as const,
      preferredExecutor: 'agent' as const,
      researchQuestions: ['Welche Best Practices gibt es?'],
      searchTerms: ['workflow', 'KI'],
      preferredSourceTypes: ['obsidian', 'nas'] as ['obsidian', 'nas'],
      excludeCriteria: [],
    },
  }

  const mockClaudeResult = {
    summary: 'KI-Workflow-Tools gewinnen an Bedeutung. Automatisierung und lokale Modelle sind zentrale Trends.',
    findings: [
      {
        title: 'Lokale Modelle bevorzugt',
        claim: 'Entwickler bevorzugen lokale Modelle fuer Datenschutz',
        confidence: 'high' as const,
        impact: 'high' as const,
        isOpenAssumption: false,
        implication: 'Local-first Ansatz ist richtig',
      },
      {
        title: 'Offene Annahme: Akzeptanz',
        claim: 'Solo-Entwickler nutzen KI-Tools aktiv',
        confidence: 'medium' as const,
        impact: 'medium' as const,
        isOpenAssumption: true,
        implication: 'Muss mit User Research validiert werden',
      },
    ],
    requirements: [
      { title: 'Lokaler LLM-Support', description: 'Ollama/LM Studio Integration', priority: 'must' as const, type: 'functional' as const },
      { title: 'Kein Internet noetig', description: 'Vollstaendig offline nutzbar', priority: 'should' as const, type: 'constraint' as const },
    ],
    risks: [
      { title: 'Akzeptanzrisiko', description: 'Tool koennte zu komplex wirken', probability: 'medium' as const, impact: 'high' as const, mitigationIdea: 'Onboarding vereinfachen', isOpenAssumption: false },
    ],
    generationNotes: 'Analyse basiert auf Brief-Kontext, keine externen Quellen.',
  }

  return { mockBrief, mockClaudeResult }
})

const mockClaudeResult = testData.mockClaudeResult

/*
const mockBrief = {
  id: 'brief-rr-1',
  title: 'KI Workflow Tool',
  status: 'in_review' as const,
  createdAt: '2026-05-17T00:00:00Z',
  updatedAt: '2026-05-17T00:00:00Z',
  rawIdea: 'Ein KI-gestütztes Workflow-Tool für Entwickler',
  problemStatement: 'Entwickler verbringen zu viel Zeit mit manueller Planung',
  targetAudience: 'Solo-Entwickler',
  desiredOutcome: 'Automatische Projektplanung aus Ideen',
  constraints: ['local-first', 'kein Cloud-Zwang'],
  scope: 'standard' as const,
  researchMode: 'quick' as const,
  privacyMode: 'local' as const,
  requirements: [],
  useCases: [],
  nonGoals: [],
  risks: [],
  researchRunIds: [],
  researchBriefDraft: {
    title: 'Research Brief: KI Workflow Tool',
    mode: 'quick' as const,
    privacyMode: 'local' as const,
    preferredExecutor: 'agent' as const,
    researchQuestions: ['Welche Best Practices gibt es?'],
    searchTerms: ['workflow', 'KI'],
    preferredSourceTypes: ['obsidian', 'nas'] as ['obsidian', 'nas'],
    excludeCriteria: [],
  },
}

const mockClaudeResult = {
  summary: 'KI-Workflow-Tools gewinnen an Bedeutung. Automatisierung und lokale Modelle sind zentrale Trends.',
  findings: [
    {
      title: 'Lokale Modelle bevorzugt',
      claim: 'Entwickler bevorzugen lokale Modelle für Datenschutz',
      confidence: 'high' as const,
      impact: 'high' as const,
      isOpenAssumption: false,
      implication: 'Local-first Ansatz ist richtig',
    },
    {
      title: 'Offene Annahme: Akzeptanz',
      claim: 'Solo-Entwickler nutzen KI-Tools aktiv',
      confidence: 'medium' as const,
      impact: 'medium' as const,
      isOpenAssumption: true,
      implication: 'Muss mit User Research validiert werden',
    },
  ],
  requirements: [
    { title: 'Lokaler LLM-Support', description: 'Ollama/LM Studio Integration', priority: 'must' as const, type: 'functional' as const },
    { title: 'Kein Internet nötig', description: 'Vollständig offline nutzbar', priority: 'should' as const, type: 'constraint' as const },
  ],
  risks: [
    { title: 'Akzeptanzrisiko', description: 'Tool könnte zu komplex wirken', probability: 'medium' as const, impact: 'high' as const, mitigationIdea: 'Onboarding vereinfachen', isOpenAssumption: false },
  ],
  generationNotes: 'Analyse basiert auf Brief-Kontext, keine externen Quellen.',
}
*/

vi.mock('@/lib/project-briefs', () => ({
  findProjectBriefById: vi.fn((id: string) => id === 'brief-rr-1' ? testData.mockBrief : undefined),
  updateProjectBrief: vi.fn((id: string, patch) =>
    id === 'brief-rr-1' ? { ...testData.mockBrief, ...patch } : null
  ),
}))

vi.mock('@/lib/ai/text-generation', () => {
  class AIProviderConfigurationError extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'AIProviderConfigurationError'
    }
  }

  return {
    AIProviderConfigurationError,
    stripJsonCodeFence: (value: string) => value.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim(),
    generateText: vi.fn().mockResolvedValue({
      text: JSON.stringify(testData.mockClaudeResult),
      provider: 'anthropic',
      model: 'claude-haiku-4-5',
      inputTokens: 500,
      outputTokens: 300,
    }),
  }
})

const makeParams = (id: string) => ({ params: { id } })

describe('GET /api/project-briefs/[id]/research-run', () => {
  it('returns research brief preview for existing brief', async () => {
    const res = await GET(new Request('http://localhost'), makeParams('brief-rr-1'))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.briefId).toBe('brief-rr-1')
    expect(data.status).toBe('ready')
    expect(data.mode).toBe('quick')
  })

  it('returns 404 for unknown brief', async () => {
    const res = await GET(new Request('http://localhost'), makeParams('not-found'))
    expect(res.status).toBe(404)
  })
})

describe('POST /api/project-briefs/[id]/research-run', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    const { generateText } = await import('@/lib/ai/text-generation')
    vi.mocked(generateText).mockResolvedValue({
      text: JSON.stringify(mockClaudeResult),
      provider: 'anthropic',
      model: 'claude-haiku-4-5',
      inputTokens: 500,
      outputTokens: 300,
    })
  })

  it('returns 503 when the selected AI provider is not configured', async () => {
    const { AIProviderConfigurationError, generateText } = await import('@/lib/ai/text-generation')
    vi.mocked(generateText).mockRejectedValueOnce(new AIProviderConfigurationError('ANTHROPIC_API_KEY not configured'))
    const res = await POST(new Request('http://localhost', { method: 'POST' }), makeParams('brief-rr-1'))
    expect(res.status).toBe(503)
  })

  it('returns 404 for unknown brief', async () => {
    const res = await POST(new Request('http://localhost', { method: 'POST' }), makeParams('not-found'))
    expect(res.status).toBe(404)
  })

  it('persists lastResearchRun on the brief after successful run', async () => {
    const { updateProjectBrief } = await import('@/lib/project-briefs')
    const res = await POST(new Request('http://localhost', { method: 'POST' }), makeParams('brief-rr-1'))
    expect(res.status).toBe(201)
    expect(vi.mocked(updateProjectBrief)).toHaveBeenCalledWith(
      'brief-rr-1',
      expect.objectContaining({ lastResearchRun: expect.objectContaining({ briefId: 'brief-rr-1', findings: expect.any(Array) }) }),
    )
  })

  it('returns run with findings and generation notes', async () => {
    const res = await POST(new Request('http://localhost', { method: 'POST' }), makeParams('brief-rr-1'))
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.run.briefId).toBe('brief-rr-1')
    expect(data.run.findings).toHaveLength(2)
    expect(data.run.openUncertainties).toHaveLength(1)
    expect(data.newRequirementsCount).toBe(2)
    expect(data.newRisksCount).toBe(1)
    expect(data.generationNotes).toBeDefined()
  })

  it('marks findings with isOpenAssumption correctly', async () => {
    const res = await POST(new Request('http://localhost', { method: 'POST' }), makeParams('brief-rr-1'))
    const data = await res.json()
    const openAssumptions = data.run.findings.filter((f: { isOpenAssumption: boolean }) => f.isOpenAssumption)
    expect(openAssumptions).toHaveLength(1)
    expect(data.run.openUncertainties).toContain(openAssumptions[0].claim)
  })
})
