/**
 * auto-router.test.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { resolveProvider, getProviderAvailability, getCurrentLlmMode } from './auto-router'

// ─── Mock dependencies ────────────────────────────────────────────────────────

vi.mock('@/lib/connectors/config', () => ({
  readStoredApiKeys: vi.fn(() => ({})),
}))

vi.mock('@/lib/ai/ollama-client', () => ({
  isOllamaRunning: vi.fn(async () => false),
  getAvailableOllamaModels: vi.fn(async () => []),
  getOllamaBaseUrl: vi.fn(() => 'http://localhost:11434'),
}))

import { readStoredApiKeys } from '@/lib/connectors/config'
import { isOllamaRunning, getAvailableOllamaModels } from '@/lib/ai/ollama-client'

const mockReadStoredApiKeys = vi.mocked(readStoredApiKeys)
const mockIsOllamaRunning = vi.mocked(isOllamaRunning)
const mockGetAvailableOllamaModels = vi.mocked(getAvailableOllamaModels)

// ─── Helpers ──────────────────────────────────────────────────────────────────

function setEnv(overrides: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined) {
      delete process.env[k]
    } else {
      process.env[k] = v
    }
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('resolveProvider', () => {
  beforeEach(() => {
    delete process.env.LLM_MODE
    delete process.env.ANTHROPIC_API_KEY
    delete process.env.GROQ_API_KEY
    delete process.env.OPENAI_API_KEY
    mockReadStoredApiKeys.mockReturnValue({} as ReturnType<typeof readStoredApiKeys>)
    mockIsOllamaRunning.mockResolvedValue(false)
    mockGetAvailableOllamaModels.mockResolvedValue([])
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('network'))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns a valid ResolvedProvider shape', async () => {
    const result = await resolveProvider()
    expect(result).toMatchObject({
      mode: expect.any(String),
      providerId: expect.any(String),
      model: expect.any(String),
      isFree: expect.any(Boolean),
      isLocal: expect.any(Boolean),
      reason: expect.any(String),
    })
  })

  it('returns placeholder when no keys and no Ollama', async () => {
    const result = await resolveProvider()
    expect(result.providerId).toBe('placeholder')
    expect(result.model).toBe('none')
  })

  it('does not throw when no provider is available', async () => {
    await expect(resolveProvider()).resolves.toBeDefined()
  })

  it('picks Anthropic when ANTHROPIC_API_KEY env is set', async () => {
    setEnv({ ANTHROPIC_API_KEY: 'sk-ant-test' })
    const result = await resolveProvider()
    expect(result.providerId).toBe('anthropic')
    expect(result.isFree).toBe(false)
    expect(result.isLocal).toBe(false)
  })

  it('picks Anthropic from stored keys when env not set', async () => {
    mockReadStoredApiKeys.mockReturnValue({ ANTHROPIC_API_KEY: 'sk-ant-stored' } as ReturnType<typeof readStoredApiKeys>)
    const result = await resolveProvider()
    expect(result.providerId).toBe('anthropic')
  })

  it('picks Groq when GROQ_API_KEY is set and no Anthropic key', async () => {
    setEnv({ GROQ_API_KEY: 'gsk_test' })
    const result = await resolveProvider()
    expect(result.providerId).toBe('groq')
    expect(result.isFree).toBe(false)
  })

  it('picks Ollama when running with models (no cloud keys)', async () => {
    mockIsOllamaRunning.mockResolvedValue(true)
    mockGetAvailableOllamaModels.mockResolvedValue(['llama3.2', 'mistral'])
    const result = await resolveProvider()
    expect(result.providerId).toBe('ollama')
    expect(result.isFree).toBe(true)
    expect(result.isLocal).toBe(true)
    expect(result.model).toBe('llama3.2')
  })

  it('prefers coding model when purpose=coding', async () => {
    mockIsOllamaRunning.mockResolvedValue(true)
    mockGetAvailableOllamaModels.mockResolvedValue(['qwen2.5-coder:7b', 'llama3.2'])
    const result = await resolveProvider('coding')
    expect(result.model).toBe('qwen2.5-coder:7b')
  })

  describe('LLM_MODE=ollama', () => {
    beforeEach(() => setEnv({ LLM_MODE: 'ollama' }))

    it('returns placeholder when Ollama is not running', async () => {
      const result = await resolveProvider()
      expect(result.providerId).toBe('placeholder')
      expect(result.mode).toBe('ollama')
    })

    it('returns ollama provider when running', async () => {
      mockIsOllamaRunning.mockResolvedValue(true)
      mockGetAvailableOllamaModels.mockResolvedValue(['llama3.3'])
      const result = await resolveProvider()
      expect(result.providerId).toBe('ollama')
      expect(result.model).toBe('llama3.3')
    })
  })

  describe('LLM_MODE=anthropic', () => {
    beforeEach(() => setEnv({ LLM_MODE: 'anthropic' }))

    it('returns placeholder when key is missing', async () => {
      const result = await resolveProvider()
      expect(result.providerId).toBe('placeholder')
      expect(result.mode).toBe('anthropic')
    })

    it('returns anthropic when key is present', async () => {
      setEnv({ LLM_MODE: 'anthropic', ANTHROPIC_API_KEY: 'sk-test' })
      const result = await resolveProvider()
      expect(result.providerId).toBe('anthropic')
    })
  })

  describe('LLM_MODE=groq', () => {
    it('returns placeholder when key is missing', async () => {
      setEnv({ LLM_MODE: 'groq' })
      const result = await resolveProvider()
      expect(result.providerId).toBe('placeholder')
    })
  })

  describe('LLM_MODE=lmstudio', () => {
    it('returns placeholder when LM Studio is not reachable', async () => {
      setEnv({ LLM_MODE: 'lmstudio' })
      const result = await resolveProvider()
      expect(result.providerId).toBe('placeholder')
      expect(result.mode).toBe('lmstudio')
    })
  })

  it('treats unknown LLM_MODE value as auto', async () => {
    setEnv({ LLM_MODE: 'totally-unknown-provider' })
    const result = await resolveProvider()
    // falls through to auto → no keys → placeholder
    expect(result.mode).toBe('auto')
  })
})

describe('getProviderAvailability', () => {
  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY
    delete process.env.GROQ_API_KEY
    mockReadStoredApiKeys.mockReturnValue({} as ReturnType<typeof readStoredApiKeys>)
    mockIsOllamaRunning.mockResolvedValue(false)
    mockGetAvailableOllamaModels.mockResolvedValue([])
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('network'))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns an array with known provider entries', async () => {
    const availability = await getProviderAvailability()
    const ids = availability.map(p => p.id)
    expect(ids).toContain('anthropic')
    expect(ids).toContain('groq')
    expect(ids).toContain('ollama')
    expect(ids).toContain('lmstudio')
  })

  it('marks anthropic as unavailable when no key', async () => {
    const availability = await getProviderAvailability()
    const anthropic = availability.find(p => p.id === 'anthropic')
    expect(anthropic?.available).toBe(false)
    expect(anthropic?.reason).toBeDefined()
  })

  it('marks anthropic as available when key is present', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test'
    const availability = await getProviderAvailability()
    const anthropic = availability.find(p => p.id === 'anthropic')
    expect(anthropic?.available).toBe(true)
    expect(anthropic?.reason).toBeUndefined()
    delete process.env.ANTHROPIC_API_KEY
  })

  it('marks ollama as unavailable when not running', async () => {
    const availability = await getProviderAvailability()
    const ollama = availability.find(p => p.id === 'ollama')
    expect(ollama?.available).toBe(false)
  })

  it('marks ollama as available when running with models', async () => {
    mockIsOllamaRunning.mockResolvedValue(true)
    mockGetAvailableOllamaModels.mockResolvedValue(['llama3.2'])
    const availability = await getProviderAvailability()
    const ollama = availability.find(p => p.id === 'ollama')
    expect(ollama?.available).toBe(true)
    expect(ollama?.isFree).toBe(true)
    expect(ollama?.isLocal).toBe(true)
  })

  it('each entry has required fields', async () => {
    const availability = await getProviderAvailability()
    for (const entry of availability) {
      expect(entry).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        available: expect.any(Boolean),
        isFree: expect.any(Boolean),
        isLocal: expect.any(Boolean),
        model: expect.any(String),
      })
    }
  })
})

describe('getCurrentLlmMode', () => {
  afterEach(() => {
    delete process.env.LLM_MODE
  })

  it('returns "auto" when LLM_MODE is not set', () => {
    delete process.env.LLM_MODE
    expect(getCurrentLlmMode()).toBe('auto')
  })

  it('returns the configured mode', () => {
    process.env.LLM_MODE = 'ollama'
    expect(getCurrentLlmMode()).toBe('ollama')
  })

  it('returns "auto" for unknown mode values', () => {
    process.env.LLM_MODE = 'mystery-provider'
    expect(getCurrentLlmMode()).toBe('auto')
  })
})
