/**
 * Tests for GET /api/ai/status
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('@/lib/connectors/config', () => ({
  readStoredApiKeys: vi.fn(() => ({})),
}))

const { mockIsOllamaRunning, mockGetAvailableOllamaModels } = vi.hoisted(() => ({
  mockIsOllamaRunning: vi.fn(),
  mockGetAvailableOllamaModels: vi.fn(),
}))

vi.mock('@/lib/ai/ollama-client', () => ({
  isOllamaRunning: mockIsOllamaRunning,
  getAvailableOllamaModels: mockGetAvailableOllamaModels,
  PREFERRED_MODELS: ['llama3.3', 'llama3.2', 'qwen2.5:7b', 'qwen2.5', 'mistral', 'gemma3', 'llama3'],
}))

import { GET } from './route'
import type { AIStatus } from './route'

beforeEach(() => {
  vi.clearAllMocks()
  delete process.env.ANTHROPIC_API_KEY
})

afterEach(() => {
  delete process.env.ANTHROPIC_API_KEY
})

describe('GET /api/ai/status', () => {
  it('returns valid AIStatus shape', async () => {
    mockIsOllamaRunning.mockResolvedValue(false)
    mockGetAvailableOllamaModels.mockResolvedValue([])

    const res = await GET()
    expect(res.status).toBe(200)

    const body = await res.json() as AIStatus
    expect(typeof body.anthropicConfigured).toBe('boolean')
    expect(typeof body.ollamaRunning).toBe('boolean')
    expect(Array.isArray(body.ollamaModels)).toBe(true)
    expect(['anthropic', 'ollama', 'none']).toContain(body.activeProvider)
    expect(typeof body.recommendation).toBe('string')
    expect(body.recommendation.length).toBeGreaterThan(0)
  })

  it('reports activeProvider=none when no key and Ollama not running', async () => {
    mockIsOllamaRunning.mockResolvedValue(false)
    mockGetAvailableOllamaModels.mockResolvedValue([])

    const res = await GET()
    const body = await res.json() as AIStatus

    expect(body.anthropicConfigured).toBe(false)
    expect(body.ollamaRunning).toBe(false)
    expect(body.activeProvider).toBe('none')
    expect(body.ollamaModels).toEqual([])
    expect(body.activeModel).toBeNull()
  })

  it('reports activeProvider=anthropic when API key is set', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key'
    mockIsOllamaRunning.mockResolvedValue(false)
    mockGetAvailableOllamaModels.mockResolvedValue([])

    const res = await GET()
    const body = await res.json() as AIStatus

    expect(body.anthropicConfigured).toBe(true)
    expect(body.activeProvider).toBe('anthropic')
  })

  it('reports activeProvider=ollama when Ollama is running with models', async () => {
    mockIsOllamaRunning.mockResolvedValue(true)
    mockGetAvailableOllamaModels.mockResolvedValue(['llama3.2', 'mistral'])

    const res = await GET()
    const body = await res.json() as AIStatus

    expect(body.anthropicConfigured).toBe(false)
    expect(body.ollamaRunning).toBe(true)
    expect(body.ollamaModels).toEqual(['llama3.2', 'mistral'])
    expect(body.activeProvider).toBe('ollama')
    expect(body.activeModel).toBe('llama3.2') // prefers llama3.2 from PREFERRED_MODELS
  })

  it('reports activeProvider=none when Ollama runs but has no models', async () => {
    mockIsOllamaRunning.mockResolvedValue(true)
    mockGetAvailableOllamaModels.mockResolvedValue([])

    const res = await GET()
    const body = await res.json() as AIStatus

    expect(body.ollamaRunning).toBe(true)
    expect(body.activeProvider).toBe('none')
    expect(body.recommendation).toContain('ollama pull')
  })

  it('anthropic takes priority over Ollama when both are available', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key'
    mockIsOllamaRunning.mockResolvedValue(true)
    mockGetAvailableOllamaModels.mockResolvedValue(['llama3.2'])

    const res = await GET()
    const body = await res.json() as AIStatus

    expect(body.activeProvider).toBe('anthropic')
  })

  it('includes recommendation mentioning Ollama when no provider is active', async () => {
    mockIsOllamaRunning.mockResolvedValue(false)
    mockGetAvailableOllamaModels.mockResolvedValue([])

    const res = await GET()
    const body = await res.json() as AIStatus

    expect(body.recommendation.toLowerCase()).toMatch(/ollama|api key/)
  })
})
