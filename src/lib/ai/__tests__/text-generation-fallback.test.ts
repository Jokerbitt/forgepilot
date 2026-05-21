/**
 * M128 — Multi-Provider Fallback tests
 *
 * Verifies that generateText() automatically retries with the configured
 * fallback provider when the primary provider throws an error.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/lib/ai/providers/config-store', () => ({
  getModelSelection: vi.fn(),
  getAllProviderConfigs: vi.fn(),
}))

vi.mock('@/lib/ai/providers/registry', () => ({
  getProviderInstance: vi.fn(),
}))

vi.mock('@/lib/connectors/config', () => ({
  readStoredApiKeys: vi.fn(() => ({})),
}))

vi.mock('@/lib/dsgvo/processing-ledger', () => ({
  logProcessing: vi.fn(),
}))

vi.mock('@sentry/nextjs', () => ({
  startSpan: vi.fn((_opts: unknown, fn: () => unknown) => fn()),
}))

vi.mock('@/lib/logger', () => ({
  aiLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

// ── Imports after mocks ────────────────────────────────────────────────────────

import { generateText, AIProviderConfigurationError } from '../text-generation'
import { getModelSelection, getAllProviderConfigs } from '@/lib/ai/providers/config-store'
import { getProviderInstance } from '@/lib/ai/providers/registry'
import { aiLogger } from '@/lib/logger'

// ── Helpers ────────────────────────────────────────────────────────────────────

const makeProvider = (id: string, text = 'ok') => ({
  id,
  generateText: vi.fn().mockResolvedValue({
    text,
    providerId: id,
    model: 'test-model',
    inputTokens: 10,
    outputTokens: 5,
  }),
})

const makeConfig = (id: string) => ({
  id,
  apiKeyRef: '',
  baseUrl: undefined,
  models: [],
  enabled: true,
  type: 'openai-compatible',
  name: id,
  isBuiltIn: false,
  dataResidency: 'local',
})

const DEFAULT_OPTIONS = {
  system: 'sys',
  prompt: 'test',
  maxTokens: 100,
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('generateText — M128 Multi-Provider Fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns primary provider result when it succeeds', async () => {
    const primary = makeProvider('primary')
    vi.mocked(getModelSelection).mockReturnValue({
      fastProvider: 'primary',
      fastModel: 'fast-model',
      codingProvider: 'primary',
      codingModel: 'coding-model',
      fastFallbackProvider: 'fallback',
      fastFallbackModel: 'fallback-model',
    })
    vi.mocked(getAllProviderConfigs).mockReturnValue([makeConfig('primary'), makeConfig('fallback')] as never)
    vi.mocked(getProviderInstance).mockReturnValue(primary as never)

    const result = await generateText(DEFAULT_OPTIONS)

    expect(result.provider).toBe('primary')
    expect(primary.generateText).toHaveBeenCalledTimes(1)
  })

  it('falls back to secondary provider when primary throws', async () => {
    const primary  = makeProvider('primary')
    const fallback = makeProvider('fallback', 'fallback-response')

    // Use a non-retryable error so retry does not interfere with fallback test
    primary.generateText.mockRejectedValue(new Error('auth error'))

    vi.mocked(getModelSelection).mockReturnValue({
      fastProvider: 'primary',
      fastModel: 'fast-model',
      codingProvider: 'primary',
      codingModel: 'coding-model',
      fastFallbackProvider: 'fallback',
      fastFallbackModel: 'fallback-model',
    })
    vi.mocked(getAllProviderConfigs).mockReturnValue([makeConfig('primary'), makeConfig('fallback')] as never)
    vi.mocked(getProviderInstance)
      .mockReturnValueOnce(primary as never)   // primary attempt
      .mockReturnValueOnce(fallback as never)  // fallback attempt

    const result = await generateText(DEFAULT_OPTIONS)

    expect(result.provider).toBe('fallback')
    expect(result.text).toBe('fallback-response')
    expect(fallback.generateText).toHaveBeenCalledTimes(1)
  })

  it('logs a warning when falling back', async () => {
    const primary  = makeProvider('primary')
    const fallback = makeProvider('fallback')

    // Use a non-retryable error so only the fallback warn is emitted, not ai.retry
    primary.generateText.mockRejectedValue(new Error('auth error'))

    vi.mocked(getModelSelection).mockReturnValue({
      fastProvider: 'primary',
      fastModel: 'fast-model',
      codingProvider: 'primary',
      codingModel: 'coding-model',
      fastFallbackProvider: 'fallback',
    })
    vi.mocked(getAllProviderConfigs).mockReturnValue([makeConfig('primary'), makeConfig('fallback')] as never)
    vi.mocked(getProviderInstance)
      .mockReturnValueOnce(primary as never)
      .mockReturnValueOnce(fallback as never)

    await generateText(DEFAULT_OPTIONS)

    expect(aiLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'ai.fallback', primaryId: 'primary', fallbackId: 'fallback' }),
      expect.any(String),
    )
  })

  it('rethrows primary error when no fallback is configured', async () => {
    const primary = makeProvider('primary')
    primary.generateText.mockRejectedValue(new Error('auth error'))

    vi.mocked(getModelSelection).mockReturnValue({
      fastProvider: 'primary',
      fastModel: 'fast-model',
      codingProvider: 'primary',
      codingModel: 'coding-model',
      // no fastFallbackProvider
    })
    vi.mocked(getAllProviderConfigs).mockReturnValue([makeConfig('primary')] as never)
    vi.mocked(getProviderInstance).mockReturnValue(primary as never)

    await expect(generateText(DEFAULT_OPTIONS)).rejects.toThrow('auth error')
  })

  it('rethrows primary error when fallback == primary (avoids infinite loop)', async () => {
    const primary = makeProvider('primary')
    primary.generateText.mockRejectedValue(new Error('down'))

    vi.mocked(getModelSelection).mockReturnValue({
      fastProvider: 'primary',
      fastModel: 'fast-model',
      codingProvider: 'primary',
      codingModel: 'coding-model',
      fastFallbackProvider: 'primary',  // same as primary
    })
    vi.mocked(getAllProviderConfigs).mockReturnValue([makeConfig('primary')] as never)
    vi.mocked(getProviderInstance).mockReturnValue(primary as never)

    await expect(generateText(DEFAULT_OPTIONS)).rejects.toThrow('down')
    expect(primary.generateText).toHaveBeenCalledTimes(1)  // NOT retried
  })

  it('throws AIProviderConfigurationError when provider not found', async () => {
    vi.mocked(getModelSelection).mockReturnValue({
      fastProvider: 'missing',
      fastModel: 'model',
      codingProvider: 'missing',
      codingModel: 'model',
    })
    vi.mocked(getAllProviderConfigs).mockReturnValue([] as never)

    await expect(generateText(DEFAULT_OPTIONS)).rejects.toThrow(AIProviderConfigurationError)
  })

  it('uses fallback model from selection when set', async () => {
    const primary  = makeProvider('primary')
    const fallback = makeProvider('fallback')

    primary.generateText.mockRejectedValue(new Error('err'))

    vi.mocked(getModelSelection).mockReturnValue({
      fastProvider: 'primary',
      fastModel: 'fast-model',
      codingProvider: 'primary',
      codingModel: 'coding-model',
      fastFallbackProvider: 'fallback',
      fastFallbackModel: 'fallback-model-v2',
    })
    vi.mocked(getAllProviderConfigs).mockReturnValue([makeConfig('primary'), makeConfig('fallback')] as never)
    vi.mocked(getProviderInstance)
      .mockReturnValueOnce(primary as never)
      .mockReturnValueOnce(fallback as never)

    await generateText(DEFAULT_OPTIONS)

    expect(fallback.generateText).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'fallback-model-v2' }),
    )
  })
})
