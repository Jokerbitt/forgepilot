/**
 * Tests for model-selection API logic
 *
 * We test the underlying config-store + BUILT_IN_PROVIDER_CONFIGS directly
 * rather than wiring up Next.js HTTP, keeping tests fast and dependency-free.
 */

import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ─── Helpers ─────────────────────────────────────────────────────────────────

let tmpDir: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fp-model-sel-'))
  // Point the data-dir to our tmp directory
  vi.resetModules()
})

afterEach(() => {
  vi.restoreAllMocks()
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

// ─── Helper: build a minimal store with a custom data dir ────────────────────

async function makeStore(dataDir: string) {
  vi.doMock('@/lib/config/paths', () => ({
    getDataDir: () => dataDir,
  }))
  const { getModelSelection, saveModelSelection, getAllProviderConfigs } =
    await import('@/lib/ai/providers/config-store')
  return { getModelSelection, saveModelSelection, getAllProviderConfigs }
}

// ─── Test: GET logic — getModelSelection returns correct values ───────────────

describe('model-selection — GET logic', () => {
  it('returns the stored modelSelection from config', async () => {
    const store = {
      providerOverrides: [],
      customProviders:   [],
      modelSelection: {
        fastProvider:   'groq',
        fastModel:      'llama-3.1-8b-instant',
        codingProvider: 'anthropic',
        codingModel:    'claude-sonnet-4-5',
      },
    }
    fs.writeFileSync(
      path.join(tmpDir, 'ai-providers.json'),
      JSON.stringify(store, null, 2),
    )

    const { getModelSelection } = await makeStore(tmpDir)
    const sel = getModelSelection()

    expect(sel.fastProvider).toBe('groq')
    expect(sel.fastModel).toBe('llama-3.1-8b-instant')
    expect(sel.codingProvider).toBe('anthropic')
    expect(sel.codingModel).toBe('claude-sonnet-4-5')
  })
})

// ─── Test: POST logic — saveModelSelection persists correctly ─────────────────

describe('model-selection — POST logic', () => {
  it('updates fastProvider + fastModel and persists to disk', async () => {
    // Start with a default store (no file yet — falls back to defaults)
    const { getModelSelection, saveModelSelection } = await makeStore(tmpDir)

    const original = getModelSelection()

    saveModelSelection({
      ...original,
      fastProvider: 'google-gemini',
      fastModel:    'gemini-2.0-flash',
    })

    const updated = getModelSelection()
    expect(updated.fastProvider).toBe('google-gemini')
    expect(updated.fastModel).toBe('gemini-2.0-flash')
    // codingProvider unchanged
    expect(updated.codingProvider).toBe(original.codingProvider)
  })
})

// ─── Test: POST validation — invalid provider returns 400 ─────────────────────

describe('model-selection — validation logic', () => {
  it('rejects an unknown providerId when validated against BUILT_IN_PROVIDER_CONFIGS', async () => {
    vi.doMock('@/lib/config/paths', () => ({
      getDataDir: () => tmpDir,
    }))
    const { getAllProviderConfigs } = await import('@/lib/ai/providers/config-store')

    const allProviders = getAllProviderConfigs()
    const unknownId    = '__nonexistent_provider__'
    const found        = allProviders.find(p => p.id === unknownId)

    // Simulates what the route does: if !provider → 400
    expect(found).toBeUndefined()
  })

  it('accepts a valid provider+model combination', async () => {
    vi.doMock('@/lib/config/paths', () => ({
      getDataDir: () => tmpDir,
    }))
    const { getAllProviderConfigs } = await import('@/lib/ai/providers/config-store')

    const allProviders = getAllProviderConfigs()
    const provider     = allProviders.find(p => p.id === 'anthropic')
    expect(provider).toBeDefined()

    const model = provider!.models.find(m => m.id === 'claude-haiku-4-5')
    expect(model).toBeDefined()
  })
})
