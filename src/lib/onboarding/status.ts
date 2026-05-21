/**
 * Onboarding Status — pure functions to determine setup progress.
 *
 * Reads from:
 *   - config/ai-providers.json  (hasProvider: at least one enabled provider with an API key)
 *   - config/idea-history.json  (hasIdea: at least one idea entry)
 *   - config/delegations.json   (hasDelegation: at least one delegation entry)
 */

import fs from 'fs'
import { getConfigPath } from '@/lib/config/paths'

export interface OnboardingStatus {
  hasProvider: boolean
  hasIdea: boolean
  hasDelegation: boolean
  isComplete: boolean
  completedSteps: number
  totalSteps: 3
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function readJsonArray(filename: string): unknown[] {
  try {
    const raw = fs.readFileSync(getConfigPath(filename), 'utf-8')
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function readJsonObject(filename: string): Record<string, unknown> {
  try {
    const raw = fs.readFileSync(getConfigPath(filename), 'utf-8')
    const parsed: unknown = JSON.parse(raw)
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
    return {}
  } catch {
    return {}
  }
}

// ─── Provider detection ───────────────────────────────────────────────────────

/**
 * Detect whether at least one AI provider has an API key configured.
 *
 * Strategy:
 *   1. Check config/ai-providers.json for providerOverrides that include an apiKey.
 *   2. Check environment variables for known provider keys (ANTHROPIC_API_KEY, etc.)
 *   3. Check config/api-keys.json for any non-empty string value.
 */
function detectHasProvider(): boolean {
  // Check providerOverrides in ai-providers.json
  const store = readJsonObject('ai-providers.json')

  const overrides = Array.isArray(store.providerOverrides) ? store.providerOverrides : []
  for (const override of overrides) {
    if (
      override !== null &&
      typeof override === 'object' &&
      !Array.isArray(override) &&
      typeof (override as Record<string, unknown>).apiKey === 'string' &&
      ((override as Record<string, unknown>).apiKey as string).trim().length > 0
    ) {
      return true
    }
  }

  const customProviders = Array.isArray(store.customProviders) ? store.customProviders : []
  for (const provider of customProviders) {
    if (
      provider !== null &&
      typeof provider === 'object' &&
      !Array.isArray(provider) &&
      typeof (provider as Record<string, unknown>).apiKey === 'string' &&
      ((provider as Record<string, unknown>).apiKey as string).trim().length > 0
    ) {
      return true
    }
  }

  // Check api-keys.json for any populated key
  try {
    const apiKeys = readJsonObject('api-keys.json')
    const knownProviderKeys = [
      'ANTHROPIC_API_KEY',
      'OPENAI_API_KEY',
      'GOOGLE_API_KEY',
      'GROQ_API_KEY',
      'MISTRAL_API_KEY',
      'TOGETHER_API_KEY',
      'COHERE_API_KEY',
    ]
    for (const key of knownProviderKeys) {
      if (typeof apiKeys[key] === 'string' && (apiKeys[key] as string).trim().length > 0) {
        return true
      }
    }
  } catch {
    // ignore
  }

  // Fallback: check environment variables
  const envKeys = [
    'ANTHROPIC_API_KEY',
    'OPENAI_API_KEY',
    'GOOGLE_API_KEY',
    'GROQ_API_KEY',
    'MISTRAL_API_KEY',
    'TOGETHER_API_KEY',
  ]
  for (const key of envKeys) {
    if (typeof process.env[key] === 'string' && (process.env[key] as string).trim().length > 0) {
      return true
    }
  }

  return false
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function getOnboardingStatus(): OnboardingStatus {
  const hasProvider = detectHasProvider()
  const hasIdea = readJsonArray('idea-history.json').length > 0
  const hasDelegation = readJsonArray('delegations.json').length > 0

  const completedSteps = [hasProvider, hasIdea, hasDelegation].filter(Boolean).length

  return {
    hasProvider,
    hasIdea,
    hasDelegation,
    isComplete: hasProvider && hasIdea && hasDelegation,
    completedSteps,
    totalSteps: 3,
  }
}
