import { beforeEach, describe, expect, it, vi } from 'vitest'
import { generateText, stripJsonCodeFence } from './text-generation'

// Mock provider config-store: Ollama as fast provider
vi.mock('@/lib/ai/providers/config-store', () => ({
  getModelSelection: vi.fn(() => ({
    fastProvider:      'ollama',
    fastModel:         'llama3.2:3b',
    codingProvider:    'ollama',
    codingModel:       'qwen2.5-coder:14b',
    embeddingProvider: 'ollama',
  })),
  getAllProviderConfigs: vi.fn(() => [{
    id:       'ollama',
    name:     'Ollama',
    type:     'local',
    apiKeyRef: '',
    baseUrl:  'http://ollama.local:11434',
    models:   [{ id: 'llama3.2:3b', name: 'LLaMA 3.2 3B', purpose: 'fast', costPer1kIn: 0, costPer1kOut: 0 }],
    dataResidency: 'local',
    enabled: true,
  }]),
}))

// Mock DSGVO ledger — fire-and-forget, no-op in tests
vi.mock('@/lib/dsgvo/processing-ledger', () => ({
  logProcessing: vi.fn(() => Promise.resolve()),
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
