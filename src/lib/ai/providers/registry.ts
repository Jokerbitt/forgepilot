/**
 * AI Provider Registry
 *
 * Central store of all available AI providers. Built-in providers are
 * pre-configured; users can add any OpenAI-compatible custom endpoint
 * via the Settings UI.
 *
 * Adding a new provider = implement AIProvider + call registerProvider().
 */

import type { AIProvider, AIProviderConfig, AIModelDef } from './types'
import { AnthropicProvider } from './anthropic'
import { OpenAICompatibleProvider } from './openai-compatible'
import { OllamaProvider } from './ollama'

// ─── Provider instances (singletons) ─────────────────────────────────────────

const PROVIDER_INSTANCES = new Map<string, AIProvider>()

function getOrCreate(id: string, factory: () => AIProvider): AIProvider {
  if (!PROVIDER_INSTANCES.has(id)) PROVIDER_INSTANCES.set(id, factory())
  return PROVIDER_INSTANCES.get(id)!
}

export function getProviderInstance(id: string): AIProvider | undefined {
  return PROVIDER_INSTANCES.get(id)
}

/** Register a custom provider instance (for dynamic/user-defined providers) */
export function registerProvider(id: string, provider: AIProvider): void {
  PROVIDER_INSTANCES.set(id, provider)
}

// ─── Built-in provider configs ────────────────────────────────────────────────

const CLAUDE_MODELS: AIModelDef[] = [
  { id: 'claude-haiku-4-5',  name: 'Claude Haiku 4.5',  purpose: 'fast',   costPer1kInput: 0.0008, costPer1kOutput: 0.004 },
  { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5', purpose: 'coding', costPer1kInput: 0.003,  costPer1kOutput: 0.015 },
  { id: 'claude-opus-4-5',   name: 'Claude Opus 4.5',   purpose: 'coding', costPer1kInput: 0.015,  costPer1kOutput: 0.075 },
]

const OPENAI_MODELS: AIModelDef[] = [
  { id: 'gpt-4o-mini',  name: 'GPT-4o Mini',  purpose: 'fast',   costPer1kInput: 0.00015, costPer1kOutput: 0.0006 },
  { id: 'gpt-4o',       name: 'GPT-4o',       purpose: 'coding', costPer1kInput: 0.005,   costPer1kOutput: 0.015 },
  { id: 'o3-mini',      name: 'o3-mini',      purpose: 'coding', costPer1kInput: 0.0011,  costPer1kOutput: 0.0044 },
  { id: 'text-embedding-3-small', name: 'Embedding 3 Small', purpose: 'embedding', costPer1kInput: 0.00002, costPer1kOutput: 0 },
]

const GROQ_MODELS: AIModelDef[] = [
  { id: 'llama-3.1-8b-instant',   name: 'Llama 3.1 8B (Instant)', purpose: 'fast',   costPer1kInput: 0.00005, costPer1kOutput: 0.00008 },
  { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B',         purpose: 'coding', costPer1kInput: 0.00059, costPer1kOutput: 0.00079 },
  { id: 'mixtral-8x7b-32768',      name: 'Mixtral 8x7B',          purpose: 'coding', costPer1kInput: 0.00027, costPer1kOutput: 0.00027 },
]

const MISTRAL_MODELS: AIModelDef[] = [
  { id: 'mistral-small-latest', name: 'Mistral Small', purpose: 'fast',   costPer1kInput: 0.001, costPer1kOutput: 0.003 },
  { id: 'mistral-large-latest', name: 'Mistral Large', purpose: 'coding', costPer1kInput: 0.003, costPer1kOutput: 0.009 },
]

const GEMINI_MODELS: AIModelDef[] = [
  { id: 'gemini-2.0-flash',   name: 'Gemini 2.0 Flash', purpose: 'fast',   costPer1kInput: 0.0001, costPer1kOutput: 0.0004 },
  { id: 'gemini-1.5-pro',     name: 'Gemini 1.5 Pro',   purpose: 'coding', costPer1kInput: 0.00125, costPer1kOutput: 0.005 },
  { id: 'text-embedding-004', name: 'Embedding 004',    purpose: 'embedding', costPer1kInput: 0, costPer1kOutput: 0 },
]

const TOGETHER_MODELS: AIModelDef[] = [
  { id: 'meta-llama/Llama-3-8b-chat-hf',  name: 'Llama 3 8B',  purpose: 'fast',   costPer1kInput: 0.0002, costPer1kOutput: 0.0002 },
  { id: 'meta-llama/Llama-3-70b-chat-hf', name: 'Llama 3 70B', purpose: 'coding', costPer1kInput: 0.0009, costPer1kOutput: 0.0009 },
]

export const BUILT_IN_PROVIDER_CONFIGS: AIProviderConfig[] = [
  {
    id: 'anthropic',
    type: 'anthropic',
    name: 'Anthropic (Claude)',
    apiKeyRef: 'ANTHROPIC_API_KEY',
    models: CLAUDE_MODELS,
    enabled: true,
    isBuiltIn: true,
    dataResidency: 'us',
  },
  {
    id: 'openai',
    type: 'openai-compatible',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    apiKeyRef: 'OPENAI_API_KEY',
    models: OPENAI_MODELS,
    enabled: false,
    isBuiltIn: true,
    dataResidency: 'us',
  },
  {
    id: 'groq',
    type: 'openai-compatible',
    name: 'Groq (Ultra-Fast)',
    baseUrl: 'https://api.groq.com/openai/v1',
    apiKeyRef: 'GROQ_API_KEY',
    models: GROQ_MODELS,
    enabled: false,
    isBuiltIn: true,
    dataResidency: 'us',
  },
  {
    id: 'mistral',
    type: 'openai-compatible',
    name: 'Mistral AI',
    baseUrl: 'https://api.mistral.ai/v1',
    apiKeyRef: 'MISTRAL_API_KEY',
    models: MISTRAL_MODELS,
    enabled: false,
    isBuiltIn: true,
    dataResidency: 'eu',
  },
  {
    id: 'google-gemini',
    type: 'openai-compatible',
    name: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    apiKeyRef: 'GOOGLE_API_KEY',
    models: GEMINI_MODELS,
    enabled: false,
    isBuiltIn: true,
    dataResidency: 'us',
  },
  {
    id: 'together',
    type: 'openai-compatible',
    name: 'Together AI',
    baseUrl: 'https://api.together.xyz/v1',
    apiKeyRef: 'TOGETHER_API_KEY',
    models: TOGETHER_MODELS,
    enabled: false,
    isBuiltIn: true,
    dataResidency: 'us',
  },
  {
    id: 'lm-studio',
    type: 'openai-compatible',
    name: 'LM Studio (Local)',
    baseUrl: 'http://localhost:1234/v1',
    apiKeyRef: '',   // no key needed
    models: [
      { id: 'local-model', name: 'Local Model (auto-detect)', purpose: 'both' },
    ],
    enabled: false,
    isBuiltIn: true,
    dataResidency: 'local',
  },
  {
    id: 'ollama',
    type: 'ollama',
    name: 'Ollama (Local)',
    baseUrl: 'http://localhost:11434',
    apiKeyRef: '',   // no key needed
    models: [
      { id: 'qwen2.5-coder:14b', name: 'Qwen 2.5 Coder 14B', purpose: 'coding' },
      { id: 'llama3.2:3b',       name: 'Llama 3.2 3B',        purpose: 'fast' },
      { id: 'nomic-embed-text',  name: 'Nomic Embed Text',    purpose: 'embedding' },
    ],
    enabled: false,
    isBuiltIn: true,
    dataResidency: 'local',
  },
]

// ─── Initialize built-in provider instances ───────────────────────────────────

getOrCreate('anthropic', () => new AnthropicProvider())
getOrCreate('openai',    () => new OpenAICompatibleProvider('openai', 'OpenAI'))
getOrCreate('groq',      () => new OpenAICompatibleProvider('groq', 'Groq', false))
getOrCreate('mistral',   () => new OpenAICompatibleProvider('mistral', 'Mistral AI', false))
getOrCreate('google-gemini', () => new OpenAICompatibleProvider('google-gemini', 'Google Gemini'))
getOrCreate('together',  () => new OpenAICompatibleProvider('together', 'Together AI', false))
getOrCreate('lm-studio', () => new OpenAICompatibleProvider('lm-studio', 'LM Studio', false))
getOrCreate('ollama',    () => new OllamaProvider())

/** Register a user-defined custom provider at runtime */
export function registerCustomProvider(config: AIProviderConfig): void {
  const instance = new OpenAICompatibleProvider(config.id, config.name, false)
  PROVIDER_INSTANCES.set(config.id, instance)
}
