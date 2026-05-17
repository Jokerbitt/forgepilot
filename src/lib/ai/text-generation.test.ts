import { beforeEach, describe, expect, it, vi } from 'vitest'
import { generateText, stripJsonCodeFence } from './text-generation'

const mockConfig = {
  aiProvider: 'ollama' as const,
  localCodingModel: 'qwen2.5-coder:14b',
  localFastModel: 'llama3.2:3b',
  approvalMode: 'balanced' as const,
  autopilotMaxRiskClass: 'A' as const,
  autopilotMinScore: 85,
  ignoreStatuses: [],
  penalizeOldBacklogs: false,
  backlogPenaltyAgeDays: 90,
  backlogPenaltyScore: 20,
  showTriageJoker: false,
  maxRecommendations: 5,
  pinnedItems: [],
  customLlmModels: [],
  projects: [],
  milestones: [],
}

vi.mock('@/lib/nba-engine/nba-config', () => ({
  getNBAConfig: vi.fn(() => mockConfig),
}))

vi.mock('@/lib/connectors/config', () => ({
  readStoredApiKeys: vi.fn(() => ({ OLLAMA_BASE_URL: 'http://ollama.local:11434/' })),
}))

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn(),
    },
  })),
}))

describe('AI text generation provider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.OLLAMA_BASE_URL
  })

  it('uses Ollama chat API with the configured fast model', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        message: { content: '{"ok":true}' },
        prompt_eval_count: 12,
        eval_count: 8,
      }), { status: 200 }),
    )

    const result = await generateText({
      system: 'Return JSON.',
      prompt: 'Ping',
      maxTokens: 128,
      purpose: 'fast',
    })

    expect(result).toMatchObject({
      provider: 'ollama',
      model: 'llama3.2:3b',
      text: '{"ok":true}',
      inputTokens: 12,
      outputTokens: 8,
    })
    expect(fetchSpy).toHaveBeenCalledWith(
      'http://ollama.local:11434/api/chat',
      expect.objectContaining({ method: 'POST' }),
    )

    fetchSpy.mockRestore()
  })

  it('strips JSON code fences', () => {
    expect(stripJsonCodeFence('```json\n{"ok":true}\n```')).toBe('{"ok":true}')
  })
})
