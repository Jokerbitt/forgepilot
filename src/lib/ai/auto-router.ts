/**
 * auto-router.ts — Automatic LLM provider resolution.
 *
 * Reads LLM_MODE env var and probes available providers in priority order:
 *   Anthropic → Groq → Ollama → LM Studio → placeholder
 *
 * Also exports selectBestProvider() for task-complexity-aware routing that
 * includes CLI-based providers (Claude Code Max, Codex Pro) as zero-key options.
 *
 * All probes are timeout-safe (≤2 s) and fail-open (never throw).
 */

import { readStoredApiKeys } from '@/lib/connectors/config'
import { isOllamaRunning, getAvailableOllamaModels, getOllamaBaseUrl } from '@/lib/ai/ollama-client'
import { getAllProviderConfigs } from '@/lib/ai/providers/config-store'
import { whichSync } from '@/lib/ai/providers/cli-runner'
import type { AIProviderConfig, ModelPurpose } from '@/lib/ai/providers/types'

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
  status?: 'connected' | 'missing' | 'faulty' | 'local-offline'
  isFree: boolean
  isLocal: boolean
  model: string
  reason?: string
  canTest?: boolean
  apiKeyRef?: string
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
const XAI_DEFAULT_MODEL = 'grok-3-mini'
const OPENAI_DEFAULT_MODEL = 'gpt-4o-mini'

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

function hasOpenAIKey(): boolean {
  return resolveStoredKey('OPENAI_API_KEY').length > 0
}

function hasXaiKey(): boolean {
  return resolveStoredKey('XAI_API_KEY').length > 0
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
  // 1. Strong cloud coding provider
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

  // 2. Strong critic provider
  if (hasXaiKey()) {
    return {
      mode: 'auto',
      providerId: 'xai',
      model: XAI_DEFAULT_MODEL,
      isFree: false,
      isLocal: false,
      reason: 'auto: XAI_API_KEY present',
    }
  }

  // 3. General cloud fallback
  if (hasOpenAIKey()) {
    return {
      mode: 'auto',
      providerId: 'openai',
      model: OPENAI_DEFAULT_MODEL,
      isFree: false,
      isLocal: false,
      reason: 'auto: OPENAI_API_KEY present',
    }
  }

  // 4. Cheap/fast cloud fallback
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

  // 5. Ollama
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

  // 6. LM Studio
  const lmStudioModel = await getLmStudioModel()
  if (lmStudioModel) {
    return {
      mode: 'auto',
      providerId: 'lm-studio',
      model: lmStudioModel,
      isFree: true,
      isLocal: true,
      reason: `auto: LM Studio running with model "${lmStudioModel}"`,
    }
  }

  // 7. Placeholder
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
      providerId: 'lm-studio',
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

  const ollamaModel = ollamaUp && ollamaModels.length > 0
    ? (pickOllamaModel(ollamaModels, 'fast') ?? ollamaModels[0])
    : 'none'

  return getAllProviderConfigs().map(config => providerConfigToAvailability(config, {
    ollamaUp,
    ollamaModel,
    ollamaModels,
    lmStudioModel,
  }))
}

function providerConfigToAvailability(
  config: AIProviderConfig,
  local: {
    ollamaUp: boolean
    ollamaModel: string
    ollamaModels: string[]
    lmStudioModel: string | null
  },
): ProviderAvailability {
  if (config.id === 'ollama') {
    const available = local.ollamaUp && local.ollamaModels.length > 0
    return {
      id: config.id,
      name: config.name,
      available,
      status: available ? 'connected' : 'local-offline',
      isFree: true,
      isLocal: true,
      model: local.ollamaModel,
      reason: !local.ollamaUp
        ? 'Ollama is not running'
        : local.ollamaModels.length === 0
          ? 'No models installed — run "ollama pull llama3.2"'
          : undefined,
      canTest: true,
    }
  }

  if (config.id === 'lm-studio') {
    return {
      id: config.id,
      name: config.name,
      available: local.lmStudioModel !== null,
      status: local.lmStudioModel !== null ? 'connected' : 'local-offline',
      isFree: true,
      isLocal: true,
      model: local.lmStudioModel ?? LMSTUDIO_DEFAULT_MODEL,
      reason: local.lmStudioModel === null ? 'LM Studio is not running on localhost:1234' : undefined,
      canTest: true,
    }
  }

  const configured = Boolean(config.apiKeyRef && resolveStoredKey(config.apiKeyRef).length > 0)
  const model = pickDefaultModel(config, 'fast') ?? pickDefaultModel(config, 'coding') ?? 'configured-model'

  return {
    id: config.id,
    name: config.name,
    available: configured,
    status: configured ? 'connected' : 'missing',
    isFree: Boolean(config.freeTier || config.models.some(modelDef => modelDef.isFree)),
    isLocal: config.dataResidency === 'local',
    model,
    reason: configured ? undefined : `${config.apiKeyRef || 'API key'} not configured`,
    apiKeyRef: config.apiKeyRef || undefined,
    canTest: configured,
  }
}

function pickDefaultModel(config: AIProviderConfig, purpose: Extract<ModelPurpose, 'fast' | 'coding'>): string | undefined {
  return config.models.find(model => model.purpose === purpose || model.purpose === 'both')?.id
}

/** Returns the current LLM_MODE as typed value (defaults to 'auto'). */
export function getCurrentLlmMode(): LLMMode {
  const raw = (process.env.LLM_MODE ?? 'auto').toLowerCase().trim()
  return isValidMode(raw) ? raw : 'auto'
}

// Re-export for convenience
export { getOllamaBaseUrl }

// ─── CLI detection ────────────────────────────────────────────────────────────

export interface CLIProviderStatus {
  claudeCLI: boolean
  codexCLI: boolean
}

/** Detect locally installed CLI providers (zero API key needed). */
export function detectCLIProviders(): CLIProviderStatus {
  return {
    claudeCLI: whichSync('claude') !== null,
    codexCLI:  whichSync('codex')  !== null,
  }
}

// ─── Task-complexity router ───────────────────────────────────────────────────

export type TaskComplexity = 'simple' | 'coding' | 'complex'

export interface RouterPreferences {
  preferLocal: boolean
  allowPaidAPIs: boolean
}

export const DEFAULT_ROUTER_PREFS: RouterPreferences = {
  preferLocal: true,
  allowPaidAPIs: true,
}

export interface RouterRecommendation {
  providerId: string
  providerName: string
  model: string
  reason: string
  isFree: boolean
  isLocal: boolean
  isCLI: boolean
  estimatedCostPer1kTokens: number
}

function pickBestModelForPurpose(
  config: AIProviderConfig,
  purpose: 'fast' | 'coding',
): string {
  const candidates = config.models.filter(
    m => m.purpose === purpose || m.purpose === 'both',
  )
  if (candidates.length === 0) return config.models[0]?.id ?? ''
  candidates.sort((a, b) => (a.costPer1kInput ?? 0) - (b.costPer1kInput ?? 0))
  return candidates[0].id
}

function cheapestEnabledProvider(
  configs: AIProviderConfig[],
  purpose: 'fast' | 'coding',
): RouterRecommendation | null {
  const ranked = configs
    .filter(c => c.enabled && c.id !== 'ollama')
    .map(c => {
      const model = pickBestModelForPurpose(c, purpose)
      const modelDef = c.models.find(m => m.id === model)
      const cost = modelDef?.costPer1kInput ?? 999
      return { config: c, model, cost, isFree: modelDef?.isFree ?? cost === 0 }
    })
    .sort((a, b) => a.cost - b.cost)

  const top = ranked[0]
  if (!top) return null

  return {
    providerId: top.config.id,
    providerName: top.config.name,
    model: top.model,
    reason: top.isFree
      ? 'Günstigster API-Provider (kostenlos)'
      : `Günstigster API-Provider ($${top.cost.toFixed(4)}/1k tokens)`,
    isFree: top.isFree,
    isLocal: false,
    isCLI: false,
    estimatedCostPer1kTokens: top.cost,
  }
}

/**
 * Selects the best available provider for a specific task complexity.
 *
 * Routing priority (local-first by default):
 *   simple  → Ollama → claude-cli → cheapest API
 *   coding  → claude-cli → codex-cli → anthropic API → cheapest API
 *   complex → claude-cli → anthropic opus → cheapest API
 */
export function selectBestProvider(
  complexity: TaskComplexity,
  prefs: RouterPreferences = DEFAULT_ROUTER_PREFS,
): RouterRecommendation | null {
  const { claudeCLI, codexCLI } = detectCLIProviders()
  const configs = getAllProviderConfigs()

  if (complexity === 'simple') {
    if (prefs.preferLocal) {
      const ollama = configs.find(c => c.id === 'ollama' && c.enabled)
      if (ollama) {
        return {
          providerId: 'ollama',
          providerName: 'Ollama (Lokal)',
          model: ollama.models[0]?.id ?? 'llama3',
          reason: 'Lokal & kostenlos — ideal für einfache Aufgaben',
          isFree: true, isLocal: true, isCLI: false,
          estimatedCostPer1kTokens: 0,
        }
      }
      if (claudeCLI) {
        return {
          providerId: 'claude-cli',
          providerName: 'Claude CLI (Max Abo)',
          model: 'claude-cli',
          reason: 'Claude CLI — kein API-Key nötig (Max-Abo)',
          isFree: true, isLocal: true, isCLI: true,
          estimatedCostPer1kTokens: 0,
        }
      }
    }
    return prefs.allowPaidAPIs ? cheapestEnabledProvider(configs, 'fast') : null
  }

  if (complexity === 'coding') {
    if (prefs.preferLocal && claudeCLI) {
      return {
        providerId: 'claude-cli',
        providerName: 'Claude CLI (Max Abo)',
        model: 'claude-cli',
        reason: 'Claude CLI — stark für Code, kein API-Key nötig',
        isFree: true, isLocal: true, isCLI: true,
        estimatedCostPer1kTokens: 0,
      }
    }
    if (prefs.preferLocal && codexCLI) {
      return {
        providerId: 'codex-cli',
        providerName: 'Codex CLI (Pro Abo)',
        model: 'codex-cli',
        reason: 'Codex CLI — spezialisiert auf Code, kein API-Key nötig',
        isFree: true, isLocal: true, isCLI: true,
        estimatedCostPer1kTokens: 0,
      }
    }
    const anthropic = configs.find(c => c.id === 'anthropic' && c.enabled)
    if (anthropic && prefs.allowPaidAPIs) {
      const model = pickBestModelForPurpose(anthropic, 'coding')
      const modelDef = anthropic.models.find(m => m.id === model)
      return {
        providerId: 'anthropic', providerName: 'Anthropic (Claude API)', model,
        reason: 'Claude API — beste Qualität für Code-Aufgaben',
        isFree: false, isLocal: false, isCLI: false,
        estimatedCostPer1kTokens: modelDef?.costPer1kInput ?? 0.003,
      }
    }
    return prefs.allowPaidAPIs ? cheapestEnabledProvider(configs, 'coding') : null
  }

  // complex
  if (prefs.preferLocal && claudeCLI) {
    return {
      providerId: 'claude-cli',
      providerName: 'Claude CLI (Max Abo)',
      model: 'claude-cli',
      reason: 'Claude CLI — auch für komplexe Architektur-Aufgaben geeignet',
      isFree: true, isLocal: true, isCLI: true,
      estimatedCostPer1kTokens: 0,
    }
  }
  const anthropic = configs.find(c => c.id === 'anthropic' && c.enabled)
  if (anthropic && prefs.allowPaidAPIs) {
    const opusModels = anthropic.models.filter(m => m.id.includes('opus'))
    const model = opusModels[opusModels.length - 1]?.id ?? pickBestModelForPurpose(anthropic, 'coding')
    const modelDef = anthropic.models.find(m => m.id === model)
    return {
      providerId: 'anthropic', providerName: 'Anthropic (Claude Opus)', model,
      reason: 'Claude Opus — beste Qualität für komplexe/architektonische Aufgaben',
      isFree: false, isLocal: false, isCLI: false,
      estimatedCostPer1kTokens: modelDef?.costPer1kInput ?? 0.015,
    }
  }
  return prefs.allowPaidAPIs ? cheapestEnabledProvider(configs, 'coding') : null
}
