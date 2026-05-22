/**
 * Tests for Grok Critic — dual-LLM evaluation layer
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mergeCriticScores } from './grok-critic'
import type { GrokCriticResult } from './grok-critic'

// ─── mergeCriticScores (pure function — no mock needed) ───────────────────────

describe('mergeCriticScores', () => {
  const baseCritic: GrokCriticResult = {
    correctnessScore: 80,
    efficiencyScore: 75,
    driftScore: 90,
    overallGrade: 'B',
    criteriaHit: [true, true, false],
    issues: [],
    verdict: 'PASS',
    reason: 'Looks good overall.',
    providerId: 'xai',
    evaluatedAt: new Date().toISOString(),
  }

  it('merges scores with 60/40 weighting', () => {
    const primary = { correctnessScore: 100, efficiencyScore: 100, driftScore: 100 }
    const merged = mergeCriticScores(primary, { ...baseCritic, correctnessScore: 80, efficiencyScore: 80, driftScore: 80 })
    // 100*0.6 + 80*0.4 = 92
    expect(merged.correctnessScore).toBe(92)
    expect(merged.efficiencyScore).toBe(92)
    expect(merged.driftScore).toBe(92)
  })

  it('is not contested when scores are close', () => {
    const primary = { correctnessScore: 80, efficiencyScore: 75, driftScore: 85 }
    const merged = mergeCriticScores(primary, baseCritic)
    expect(merged.contested).toBe(false)
    expect(merged.contestReason).toBeUndefined()
  })

  it('flags contested when scores diverge by >25 points', () => {
    const primary = { correctnessScore: 95, efficiencyScore: 90, driftScore: 95 }
    const critic: GrokCriticResult = {
      ...baseCritic,
      correctnessScore: 40,  // diverges by 55 points
      efficiencyScore: 70,
      driftScore: 80,
    }
    const merged = mergeCriticScores(primary, critic)
    expect(merged.contested).toBe(true)
    expect(merged.contestReason).toContain('human review')
  })

  it('rounds merged scores to integers', () => {
    const primary = { correctnessScore: 77, efficiencyScore: 83, driftScore: 61 }
    const merged = mergeCriticScores(primary, { ...baseCritic, correctnessScore: 63, efficiencyScore: 57, driftScore: 79 })
    expect(Number.isInteger(merged.correctnessScore)).toBe(true)
    expect(Number.isInteger(merged.efficiencyScore)).toBe(true)
    expect(Number.isInteger(merged.driftScore)).toBe(true)
  })

  it('handles perfect agreement (0 divergence)', () => {
    const primary = { correctnessScore: 85, efficiencyScore: 85, driftScore: 85 }
    const merged = mergeCriticScores(primary, { ...baseCritic, correctnessScore: 85, efficiencyScore: 85, driftScore: 85 })
    expect(merged.correctnessScore).toBe(85)
    expect(merged.contested).toBe(false)
  })
})

// ─── runGrokCritic — graceful degradation when xAI not configured ─────────────

const { mockGenerateText } = vi.hoisted(() => ({
  mockGenerateText: vi.fn(() => Promise.resolve({ text: '', provider: 'xai', model: 'grok-3-mini' })),
}))

vi.mock('@/lib/ai/text-generation', () => ({
  generateText: mockGenerateText,
  stripJsonCodeFence: (value: string) => value.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim(),
}))

vi.mock('@/lib/ai/providers/config-store', () => ({
  getModelSelection: () => ({
    codingProvider: 'xai',
    codingModel: 'grok-3-mini',
    fastProvider: 'ollama',
    fastModel: 'llama3.2:3b',
  }),
  getAllProviderConfigs: () => [
    { id: 'xai', name: 'xAI', apiKeyRef: 'XAI_API_KEY', dataResidency: 'us' },
    { id: 'anthropic', name: 'Anthropic', apiKeyRef: 'ANTHROPIC_API_KEY', dataResidency: 'us' },
    { id: 'openrouter', name: 'OpenRouter', apiKeyRef: 'OPENROUTER_API_KEY', dataResidency: 'us' },
    { id: 'google-gemini', name: 'Google Gemini', apiKeyRef: 'GOOGLE_API_KEY', dataResidency: 'us' },
    { id: 'ollama', name: 'Ollama', apiKeyRef: '', dataResidency: 'local' },
    { id: 'lm-studio', name: 'LM Studio', apiKeyRef: '', dataResidency: 'local' },
  ],
}))

vi.mock('@/lib/connectors/config', () => ({
  readStoredApiKeys: () => ({}),
}))

describe('runGrokCritic', async () => {
  const { getCriticProviderPlan, runGrokCritic } = await import('./grok-critic')

  const sampleInput = {
    delegationTitle: 'Add CSV export endpoint',
    delegationContract: 'Create GET /api/work-items/export that returns CSV',
    acceptanceCriteria: ['Returns Content-Type text/csv', 'Includes all work item fields'],
    agentOutput: 'Implemented the export route with proper headers and CSV generation.',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.FORGEPILOT_CRITIC_MODE
    delete process.env.FORGEPILOT_CRITIC_PROVIDER
    delete process.env.FORGEPILOT_CRITIC_MODEL
    delete process.env.FORGEPILOT_CRITIC_PROVIDERS
  })

  it('returns null when all critic providers throw', async () => {
    mockGenerateText.mockRejectedValue(new Error('No provider available'))
    const result = await runGrokCritic(sampleInput)
    expect(result).toBeNull()
  })

  it('returns null when response is not valid JSON', async () => {
    mockGenerateText.mockResolvedValueOnce({ text: 'This is not JSON', provider: 'xai', model: 'grok-3-mini' })
    const result = await runGrokCritic(sampleInput)
    expect(result).toBeNull()
  })

  it('returns GrokCriticResult when response is valid JSON', async () => {
    const mockResponse = {
      correctnessScore: 85,
      efficiencyScore: 90,
      driftScore: 95,
      overallGrade: 'A',
      criteriaHit: [true, true],
      issues: [],
      verdict: 'PASS',
      reason: 'Well implemented, both criteria met.',
    }
    mockGenerateText.mockResolvedValueOnce({
      text: JSON.stringify(mockResponse),
      provider: 'xai',
      model: 'grok-3-mini',
    })

    const result = await runGrokCritic(sampleInput)
    expect(result).not.toBeNull()
    expect(result!.correctnessScore).toBe(85)
    expect(result!.verdict).toBe('PASS')
    expect(result!.providerId).toBe('xai')
    expect(result!.evaluatedAt).toBeTruthy()
  })

  it('falls back to local Ollama when xAI is unavailable', async () => {
    process.env.FORGEPILOT_CRITIC_PROVIDERS = 'xai:grok-3-mini,ollama:qwen2.5-coder:14b'
    const mockResponse = {
      correctnessScore: 78,
      efficiencyScore: 82,
      driftScore: 90,
      overallGrade: 'B',
      criteriaHit: [true, false],
      issues: ['Second acceptance criterion is not proven by the output.'],
      verdict: 'NEEDS_REVISION',
      reason: 'Mostly implemented, but one criterion needs evidence.',
    }
    mockGenerateText
      .mockRejectedValueOnce(new Error('Provider "xai" not configured'))
      .mockResolvedValueOnce({
        text: JSON.stringify(mockResponse),
        provider: 'ollama',
        model: 'qwen2.5-coder:14b',
      })

    const result = await runGrokCritic(sampleInput)

    expect(result).not.toBeNull()
    expect(result!.providerId).toBe('ollama')
    expect(result!.verdict).toBe('NEEDS_REVISION')
    expect(mockGenerateText).toHaveBeenNthCalledWith(2, expect.objectContaining({
      providerId: 'ollama',
      anthropicModel: 'qwen2.5-coder:14b',
    }))
  })

  it('supports arbitrary critic provider chains from env', () => {
    const plan = getCriticProviderPlan({
      FORGEPILOT_CRITIC_MODE: 'auto',
      FORGEPILOT_CRITIC_PROVIDERS: 'openrouter=qwen/qwen-2.5-72b-instruct:free,lm-studio=local-model,custom-critic=my-model',
    })

    expect(plan.mode).toBe('auto')
    expect(plan.candidates.slice(0, 3)).toEqual([
      expect.objectContaining({ providerId: 'openrouter', model: 'qwen/qwen-2.5-72b-instruct:free' }),
      expect.objectContaining({ providerId: 'lm-studio', model: 'local-model' }),
      expect.objectContaining({ providerId: 'custom-critic', model: 'my-model' }),
    ])
  })

  it('single mode uses only the configured critic provider', () => {
    const plan = getCriticProviderPlan({
      FORGEPILOT_CRITIC_MODE: 'single',
      FORGEPILOT_CRITIC_PROVIDER: 'anthropic',
      FORGEPILOT_CRITIC_MODEL: 'claude-opus-4-5',
    })

    expect(plan.candidates).toEqual([
      expect.objectContaining({ providerId: 'anthropic', model: 'claude-opus-4-5' }),
    ])
  })

  it('retries once when local critic returns invalid JSON', async () => {
    process.env.FORGEPILOT_CRITIC_PROVIDERS = 'ollama:qwen2.5-coder:14b'
    const mockResponse = {
      correctnessScore: 88,
      efficiencyScore: 80,
      driftScore: 85,
      overallGrade: 'B',
      criteriaHit: [true, true],
      issues: [],
      verdict: 'PASS',
      reason: 'Valid on retry.',
    }
    mockGenerateText
      .mockResolvedValueOnce({ text: '{ invalid json', provider: 'ollama', model: 'qwen2.5-coder:14b' })
      .mockResolvedValueOnce({ text: JSON.stringify(mockResponse), provider: 'ollama', model: 'qwen2.5-coder:14b' })

    const result = await runGrokCritic(sampleInput)

    expect(result).not.toBeNull()
    expect(result!.providerId).toBe('ollama')
    expect(result!.reason).toBe('Valid on retry.')
    expect(mockGenerateText).toHaveBeenCalledTimes(2)
  })

  it('truncates very long agent output to avoid token overflow', async () => {
    mockGenerateText.mockResolvedValueOnce({ text: '', provider: 'xai', model: 'grok-3-mini' })
    const longOutput = 'x'.repeat(10000)
    await runGrokCritic({ ...sampleInput, agentOutput: longOutput }).catch(() => null)
    const rawCalls = mockGenerateText.mock.calls as unknown as Array<[{ prompt: string }]>
    const callArg = rawCalls[0]?.[0]
    expect(callArg?.prompt.length).toBeLessThan(10000)
  })
})

// ─── runGrokCodeReview — graceful degradation ─────────────────────────────────

describe('runGrokCodeReview', async () => {
  const { runGrokCodeReview } = await import('./grok-critic')

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null when all critic providers throw', async () => {
    mockGenerateText
      .mockRejectedValueOnce(new Error('xAI unavailable'))
      .mockRejectedValueOnce(new Error('Ollama unavailable'))
    const result = await runGrokCodeReview({ filePath: 'route.ts', fileContent: 'export {}' })
    expect(result).toBeNull()
  })

  it('returns CodeReviewResult on valid JSON response', async () => {
    const mockReview = {
      securityIssues: [{ severity: 'HIGH', issue: 'Missing Zod validation', fix: 'Use parseBody()' }],
      correctnessIssues: [],
      verdict: 'REQUEST_CHANGES',
      summary: 'Add input validation before this is safe to ship.',
    }
    mockGenerateText.mockResolvedValueOnce({
      text: JSON.stringify(mockReview),
      provider: 'xai',
      model: 'grok-3-mini',
    })

    const result = await runGrokCodeReview({ filePath: 'src/app/api/test/route.ts', fileContent: 'export async function POST() {}' })
    expect(result).not.toBeNull()
    expect(result!.verdict).toBe('REQUEST_CHANGES')
    expect(result!.securityIssues).toHaveLength(1)
    expect(result!.securityIssues[0].severity).toBe('HIGH')
  })
})
