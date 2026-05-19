/**
 * AI Provider Config Store
 *
 * Persists provider configs + model selection in config/ai-providers.json.
 * Separate from nba-settings.json to keep concerns isolated.
 */

import fs from 'fs'
import path from 'path'
import { getDataDir } from '@/lib/config/paths'
import type { AIProviderConfig, AIModelSelection } from './types'
import { BUILT_IN_PROVIDER_CONFIGS, registerCustomProvider } from './registry'

interface AIProvidersStore {
  /** Overrides / additions on top of built-in configs */
  providerOverrides: Partial<AIProviderConfig>[]
  /** User-defined custom providers */
  customProviders: AIProviderConfig[]
  modelSelection: AIModelSelection
}

const DEFAULT_SELECTION: AIModelSelection = {
  fastProvider: 'anthropic',
  fastModel: 'claude-haiku-4-5',
  codingProvider: 'anthropic',
  codingModel: 'claude-sonnet-4-5',
}

function getStorePath(): string {
  return path.join(getDataDir(), 'ai-providers.json')
}

function readStore(): AIProvidersStore {
  try {
    return JSON.parse(fs.readFileSync(getStorePath(), 'utf-8')) as AIProvidersStore
  } catch {
    return { providerOverrides: [], customProviders: [], modelSelection: DEFAULT_SELECTION }
  }
}

function writeStore(store: AIProvidersStore): void {
  const dir = path.dirname(getStorePath())
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const tmp = getStorePath() + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2), 'utf-8')
  fs.renameSync(tmp, getStorePath())
}

/** Merge built-in configs with stored overrides and custom providers */
export function getAllProviderConfigs(): AIProviderConfig[] {
  const store = readStore()

  const overrideMap = new Map(store.providerOverrides.map(o => [o.id!, o]))

  const builtIn = BUILT_IN_PROVIDER_CONFIGS.map(cfg => ({
    ...cfg,
    ...(overrideMap.get(cfg.id) ?? {}),
  }))

  // Register custom provider instances
  for (const custom of store.customProviders) {
    registerCustomProvider(custom)
  }

  return [...builtIn, ...store.customProviders]
}

export function getEnabledProviderConfigs(): AIProviderConfig[] {
  return getAllProviderConfigs().filter(p => p.enabled)
}

export function getModelSelection(): AIModelSelection {
  return readStore().modelSelection ?? DEFAULT_SELECTION
}

export function saveModelSelection(selection: AIModelSelection): void {
  const store = readStore()
  store.modelSelection = selection
  writeStore(store)
}

export function upsertProviderConfig(partial: Partial<AIProviderConfig> & { id: string }): void {
  const store = readStore()
  const isBuiltIn = BUILT_IN_PROVIDER_CONFIGS.some(c => c.id === partial.id)

  if (isBuiltIn) {
    const idx = store.providerOverrides.findIndex(o => o.id === partial.id)
    if (idx >= 0) store.providerOverrides[idx] = { ...store.providerOverrides[idx], ...partial }
    else store.providerOverrides.push(partial)
  } else {
    const idx = store.customProviders.findIndex(c => c.id === partial.id)
    if (idx >= 0) store.customProviders[idx] = { ...store.customProviders[idx], ...partial } as AIProviderConfig
    else store.customProviders.push(partial as AIProviderConfig)
    registerCustomProvider(partial as AIProviderConfig)
  }

  writeStore(store)
}

export function deleteCustomProvider(id: string): void {
  const store = readStore()
  store.customProviders = store.customProviders.filter(c => c.id !== id)
  writeStore(store)
}
