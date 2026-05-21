/**
 * auto-router.ts — Automatic LLM provider resolution.
 *
 * Reads LLM_MODE env var and probes available providers in priority order:
 *   Anthropic → Groq → Ollama → LM Studio → placeholder
 *
 * All probes are timeout-safe (≤2 s) and fail-open (never throw).
 */

import { readStoredApiKeys } from '@/lib/connectors/config'
import { isOllamaRunning, getAvailableOllamaModels, getOllamaBaseUrl } from '@/lib/ai/ollama-client'

// ─── Public types ─────────────────────────────────────────────────────────────

export type LLMMode = 'auto' | 'anthropic' | 'ollama' | 'groq' | 'openai' | 'lmstudio'

export interface ResolvedProvider {
  mode: LLMMode
  providerId: string
  model: string
  isFree: boolean
  isLocal: boolean
  reason: string
}

export interface ProviderAvailability {
  id: string
  name: string
  available: boolean
  isFree: boolean
  isLocal: boolean
  model: string
  reason?: string
}

// ─── Model priority lists ─────────────────────────────────────────────────────

const OLLAMA_FAST_MODELS = [
  'llama3.3',
  'llama3.2',
  'qwen2.5:7b',
  'qwen2.5',
  'gemma3:12b',
  'gemma3',
  'mistral',
]

const OLLAMA_CODING_MODELS = [
  'qwen2.5-coder:7b',
  'qwen2.5-coder',
  'codellama',
  'deepseek-coder',
  ...OLLAMA_FAST_MODELS,
]

const LMSTUDIO_DEFAULT_MODEL = 'local-model'
const ANTHROPIC_DEFAULT_MODEL = 'claude-haiku-4-5'
const GROQ_DEFAULT_MODEL = 'llama-3.3-70b-versatile'

// ─── Probe helpers ────────────────────────────────────────────────────────────

function resolveStoredKey(keyName: string): string {
  const stored = readStoredApiKeys() as Record<string, string | undefined>
  return process.env[keyName] ?? stored[keyName] ?? ''
}

function hasAnthropicKey(): boolean {
  return resolveStoredKey('ANTHROPIC_API_KEY').length > 0
}

function hasGroqKey(): boolean {
  return resolveStoredKey('GROQ_API_KEY').length > 0
}

/** Probe LM Studio at localhost:1234. Timeout-safe, fail-open. */
async function isLmStudioRunning(): Promise<boolean> {
  try {
    const res = await fetch('http://localhost:1234/v1/models', {
      signal: AbortSignal.timeout(2000),
    })
    return res.ok
  } catch {
    return false
  }
}

/** Returns the first LM Studio model name, or null. */
async function getLmStudioModel(): Promise<string | null> {
  try {
    const res = await fetch('http://localhost:1234/v1/models', {
      signal: AbortSignal.timeout(2000),
    })
    if (!res.ok) return null
    const data = await res.json() as { data?: Array<{ id: string }> }
    return data.data?.[0]?.id ?? null
  } catch {
    return null
  }
}

/** Pick best Ollama model for a given purpose from the installed list. */
function pickOllamaModel(available: string[], purpose: 'fast' | 'coding'): string | null {
  const preferred = purpose === 'coding' ? OLLAMA_CODING_MODELS : OLLAMA_FAST_MODELS
  for (const pref of preferred) {
    const found = available.find(a => a === pref || a.startsWith(`${pref}:`))
    if (found) return found
  }
  return available[0] ?? null
}

// ─── Core resolution ──────────────────────────────────────────────────────────

/**
 * Resolves which provider to use based on LLM_MODE env var and available providers.
 *
 * - LLM_MODE=auto      → Anthropic → Groq → Ollama → LM Studio → placeholder
 * - LLM_MODE=anthropic → use Anthropic (falls back to placeholder if no key)
 * - LLM_MODE=groq      → use Groq (falls back to placeholder if no key)
 * - LLM_MODE=ollama    → use Ollama (falls back to placeholder if not running)
 * - LLM_MODE=lmstudio  → use LM Studio (falls back to placeholder if not running)
 * - LLM_MODE=openai    → use OpenAI directly
 * - Unset              → 'auto' behaviour
 */
export async function resolveProvider(purpose: 'fast' | 'coding' = 'fast'): Promise<ResolvedProvider> {
  const rawMode = (process.env.LLM_MODE ?? 'auto').toLowerCase().trim()
  const mode: LLMMode = isValidMode(rawMode) ? rawMode : 'auto'

  switch (mode) {
    case 'anthropic':
      return resolveAnthropicDirect()
    case 'groq':
      return resolveGroqDirect()
    case 'ollama':
      return resolveOllamaDirect(purpose)
    case 'lmstudio':
      return resolveLmStudioDirect()
    case 'openai':
      return resolveOpenAIDirect()
    case 'auto':
    default:
      return resolveAuto(purpose)
  }
}

function isValidMode(value: string): value is LLMMode {
  return ['auto', 'anthropic', 'ollama', 'groq', 'openai', 'lmstudio'].includes(value)
}

async function resolveAuto(purpose: 'fast' | 'coding'): Promise<ResolvedProvider> {
  // 1. Anthropic
  if (hasAnthropicKey()) {
    return {
      mode: 'auto',
      providerId: 'anthropic',
      model: ANTHROPIC_DEFAULT_MODEL,
      isFree: false,
      isLocal: false,
      reason: 'auto: ANTHROPIC_API_KEY present',
    }
  }

  // 2. Groq
  if (hasGroqKey()) {
    return {
      mode: 'auto',
      providerId: 'groq',
      model: GROQ_DEFAULT_MODEL,
      isFree: false,
      isLocal: false,
      reason: 'auto: GROQ_API_KEY present',
    }
  }

  // 3. Ollama
  const [ollamaUp, ollamaModels] = await Promise.all([
    isOllamaRunning(),
    isOllamaRunning().then(up => up ? getAvailableOllamaModels() : []),
  ])

  if (ollamaUp && ollamaModels.length > 0) {
    const model = pickOllamaModel(ollamaModels, purpose) ?? ollamaModels[0]
    return {
      mode: 'auto',
      providerId: 'ollama',
      model,
      isFree: true,
      isLocal: true,
      reason: `auto: Ollama running with model "${model}"`,
    }
  }

  // 4. LM Studio
  const lmStudioModel = await getLmStudioModel()
  if (lmStudioModel) {
    return {
      mode: 'auto',
      providerId: 'lmstudio',
      model: lmStudioModel,
      isFree: true,
      isLocal: true,
      reason: `auto: LM Studio running with model "${lmStudioModel}"`,
    }
  }

  // 5. Placeholder
  return placeholderProvider('auto', 'no provider available — configure an API key or start Ollama/LM Studio')
}

async function resolveAnthropicDirect(): Promise<ResolvedProvider> {
  if (hasAnthropicKey()) {
    return {
      mode: 'anthropic',
      providerId: 'anthropic',
      model: ANTHROPIC_DEFAULT_MODEL,
      isFree: false,
      isLocal: false,
      reason: 'LLM_MODE=anthropic, API key present',
    }
  }
  return placeholderProvider('anthropic', 'LLM_MODE=anthropic but ANTHROPIC_API_KEY is missing')
}

async function resolveGroqDirect(): Promise<ResolvedProvider> {
  if (hasGroqKey()) {
    return {
      mode: 'groq',
      providerId: 'groq',
      model: GROQ_DEFAULT_MODEL,
      isFree: false,
      isLocal: false,
      reason: 'LLM_MODE=groq, API key present',
    }
  }
  return placeholderProvider('groq', 'LLM_MODE=groq but GROQ_API_KEY is missing')
}

async function resolveOllamaDirect(purpose: 'fast' | 'coding'): Promise<ResolvedProvider> {
  const [up, models] = await Promise.all([
    isOllamaRunning(),
    isOllamaRunning().then(r => r ? getAvailableOllamaModels() : []),
  ])

  if (up && models.length > 0) {
    const model = pickOllamaModel(models, purpose) ?? models[0]
    return {
      mode: 'ollama',
      providerId: 'ollama',
      model,
      isFree: true,
      isLocal: true,
      reason: `LLM_MODE=ollama, running with model "${model}"`,
    }
  }

  if (up && models.length === 0) {
    return placeholderProvider('ollama', 'Ollama is running but no models are installed — run "ollama pull llama3.2"')
  }

  return placeholderProvider('ollama', 'LLM_MODE=ollama but Ollama is not running')
}

async function resolveLmStudioDirect(): Promise<ResolvedProvider> {
  const model = await getLmStudioModel()
  if (model) {
    return {
      mode: 'lmstudio',
      providerId: 'lmstudio',
      model,
      isFree: true,
      isLocal: true,
      reason: `LLM_MODE=lmstudio, running with model "${model}"`,
    }
  }
  return placeholderProvider('lmstudio', 'LLM_MODE=lmstudio but LM Studio is not running on localhost:1234')
}

function resolveOpenAIDirect(): ResolvedProvider {
  const key = resolveStoredKey('OPENAI_API_KEY')
  if (key.length > 0) {
    return {
      mode: 'openai',
      providerId: 'openai',
      model: 'gpt-4o-mini',
      isFree: false,
      isLocal: false,
      reason: 'LLM_MODE=openai, API key present',
    }
  }
  return placeholderProvider('openai', 'LLM_MODE=openai but OPENAI_API_KEY is missing')
}

function placeholderProvider(mode: LLMMode, reason: string): ResolvedProvider {
  return {
    mode,
    providerId: 'placeholder',
    model: 'none',
    isFree: true,
    isLocal: true,
    reason,
  }
}

// ─── Full availability scan ───────────────────────────────────────────────────

/**
 * Returns the availability status of all known providers.
 * Used by /settings and /api/ai/status to show the full picture.
 */
export async function getProviderAvailability(): Promise<ProviderAvailability[]> {
  const [ollamaUp, ollamaModels, lmStudioModel] = await Promise.all([
    isOllamaRunning(),
    isOllamaRunning().then(up => up ? getAvailableOllamaModels() : []),
    getLmStudioModel(),
  ])

  const anthropicAvailable = hasAnthropicKey()
  const groqAvailable = hasGroqKey()

  const ollamaModel = ollamaUp && ollamaModels.length > 0
    ? (pickOllamaModel(ollamaModels, 'fast') ?? ollamaModels[0])
    : 'none'

  return [
    {
      id: 'anthropic',
      name: 'Anthropic',
      available: anthropicAvailable,
      isFree: false,
      isLocal: false,
      model: ANTHROPIC_DEFAULT_MODEL,
      reason: anthropicAvailable ? undefined : 'ANTHROPIC_API_KEY not configured',
    },
    {
      id: 'groq',
      name: 'Groq',
      available: groqAvailable,
      isFree: false,
      isLocal: false,
      model: GROQ_DEFAULT_MODEL,
      reason: groqAvailable ? undefined : 'GROQ_API_KEY not configured',
    },
    {
      id: 'ollama',
      name: 'Ollama (local)',
      available: ollamaUp && ollamaModels.length > 0,
      isFree: true,
      isLocal: true,
      model: ollamaModel,
      reason: !ollamaUp
        ? 'Ollama is not running'
        : ollamaModels.length === 0
          ? 'No models installed — run "ollama pull llama3.2"'
          : undefined,
    },
    {
      id: 'lmstudio',
      name: 'LM Studio (local)',
      available: lmStudioModel !== null,
      isFree: true,
      isLocal: true,
      model: lmStudioModel ?? LMSTUDIO_DEFAULT_MODEL,
      reason: lmStudioModel === null ? 'LM Studio is not running on localhost:1234' : undefined,
    },
  ]
}

/** Returns the current LLM_MODE as typed value (defaults to 'auto'). */
export function getCurrentLlmMode(): LLMMode {
  const raw = (process.env.LLM_MODE ?? 'auto').toLowerCase().trim()
  return isValidMode(raw) ? raw : 'auto'
}

// Re-export for convenience
export { getOllamaBaseUrl }
