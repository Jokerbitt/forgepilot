/**
 * @vitest-environment node
 *
 * Tests for selectBestProvider + detectCLIProviders (auto-router additions).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks (must be before imports) ────────────────────────────────────────────

vi.mock('@/lib/connectors/config', () => ({
  readStoredApiKeys: vi.fn(() => ({})),
}))

vi.mock('@/lib/ai/ollama-client', () => ({
  isOllamaRunning: vi.fn(async () => false),
  getAvailableOllamaModels: vi.fn(async () => []),
  getOllamaBaseUrl: vi.fn(() => 'http://localhost:11434'),
}))

const mockWhichSync = vi.fn<(a: string) => string | null>()
vi.mock('@/lib/ai/providers/cli-runner', () => ({
  whichSync: (bin: string) => mockWhichSync(bin),
}))

const mockGetAllProviderConfigs = vi.fn()
vi.mock('@/lib/ai/providers/config-store', () => ({
  getAllProviderConfigs: () => mockGetAllProviderConfigs(),
  getEnabledProviderConfigs: vi.fn(() => []),
}))

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { detectCLIProviders, selectBestProvider } from './auto-router'

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('detectCLIProviders', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetAllProviderConfigs.mockReturnValue([])
  })

  it('reports both CLIs unavailable when not installed', () => {
    mockWhichSync.mockReturnValue(null)
    const status = detectCLIProviders()
    expect(status.claudeCLI).toBe(false)
    expect(status.codexCLI).toBe(false)
  })

  it('reports claudeCLI available when binary found', () => {
    mockWhichSync.mockImplementation(bin => bin === 'claude' ? '/usr/local/bin/claude' : null)
    const status = detectCLIProviders()
    expect(status.claudeCLI).toBe(true)
    expect(status.codexCLI).toBe(false)
  })

  it('reports codexCLI available when binary found', () => {
    mockWhichSync.mockImplementation(bin => bin === 'codex' ? '/usr/local/bin/codex' : null)
    const status = detectCLIProviders()
    expect(status.claudeCLI).toBe(false)
    expect(status.codexCLI).toBe(true)
  })
})

describe('selectBestProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockWhichSync.mockReturnValue(null)
    mockGetAllProviderConfigs.mockReturnValue([])
  })

  it('returns null when no providers available and paid APIs disallowed', () => {
    const result = selectBestProvider('simple', { preferLocal: false, allowPaidAPIs: false })
    expect(result).toBeNull()
  })

  it('prefers Ollama for simple+preferLocal when configured', () => {
    mockGetAllProviderConfigs.mockReturnValue([
      {
        id: 'ollama', name: 'Ollama (Local)', enabled: true,
        models: [{ id: 'llama3', name: 'Llama 3', purpose: 'fast' }],
      },
    ])
    const result = selectBestProvider('simple', { preferLocal: true, allowPaidAPIs: true })
    expect(result?.providerId).toBe('ollama')
    expect(result?.isFree).toBe(true)
    expect(result?.isLocal).toBe(true)
    expect(result?.isCLI).toBe(false)
  })

  it('falls back to claude-cli for simple when Ollama absent', () => {
    mockWhichSync.mockImplementation(bin => bin === 'claude' ? '/usr/local/bin/claude' : null)
    const result = selectBestProvider('simple', { preferLocal: true, allowPaidAPIs: true })
    expect(result?.providerId).toBe('claude-cli')
    expect(result?.isCLI).toBe(true)
    expect(result?.isFree).toBe(true)
  })

  it('picks claude-cli for coding when preferLocal=true and available', () => {
    mockWhichSync.mockImplementation(bin => bin === 'claude' ? '/usr/local/bin/claude' : null)
    const result = selectBestProvider('coding', { preferLocal: true, allowPaidAPIs: true })
    expect(result?.providerId).toBe('claude-cli')
    expect(result?.isCLI).toBe(true)
  })

  it('falls back to codex-cli for coding when claude-cli absent but codex present', () => {
    mockWhichSync.mockImplementation(bin => bin === 'codex' ? '/usr/local/bin/codex' : null)
    const result = selectBestProvider('coding', { preferLocal: true, allowPaidAPIs: true })
    expect(result?.providerId).toBe('codex-cli')
  })

  it('picks anthropic API for coding when preferLocal=false and configured', () => {
    mockGetAllProviderConfigs.mockReturnValue([
      {
        id: 'anthropic', name: 'Anthropic', enabled: true,
        models: [{ id: 'claude-sonnet-4-5', name: 'Sonnet', purpose: 'coding', costPer1kInput: 0.003 }],
      },
    ])
    const result = selectBestProvider('coding', { preferLocal: false, allowPaidAPIs: true })
    expect(result?.providerId).toBe('anthropic')
    expect(result?.isFree).toBe(false)
    expect(result?.isLocal).toBe(false)
  })

  it('picks claude-cli for complex tasks when preferLocal=true and CLI available', () => {
    mockWhichSync.mockImplementation(bin => bin === 'claude' ? '/usr/local/bin/claude' : null)
    const result = selectBestProvider('complex', { preferLocal: true, allowPaidAPIs: true })
    expect(result?.providerId).toBe('claude-cli')
  })

  it('picks anthropic opus for complex tasks when preferLocal=false', () => {
    mockGetAllProviderConfigs.mockReturnValue([
      {
        id: 'anthropic', name: 'Anthropic', enabled: true,
        models: [
          { id: 'claude-haiku-4-5', name: 'Haiku', purpose: 'fast', costPer1kInput: 0.0008 },
          { id: 'claude-opus-4-5',  name: 'Opus',  purpose: 'coding', costPer1kInput: 0.015 },
        ],
      },
    ])
    const result = selectBestProvider('complex', { preferLocal: false, allowPaidAPIs: true })
    expect(result?.providerId).toBe('anthropic')
    expect(result?.model).toBe('claude-opus-4-5')
  })
})
