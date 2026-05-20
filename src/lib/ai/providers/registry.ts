/**
 * AI Provider Registry
 *
 * Central store of all available AI providers. Built-in providers are
 * pre-configured; users can add any OpenAI-compatible custom endpoint
 * via the Settings UI.
 *
 * Adding a new provider = implement AIProvider + call registerProvider().
 */

import type { AIProvider, AIProviderConfig } from './types'
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

export { BUILT_IN_PROVIDER_CONFIGS } from './catalog'

// ─── Initialize built-in provider instances ───────────────────────────────────

getOrCreate('anthropic',    () => new AnthropicProvider())
getOrCreate('openai',       () => new OpenAICompatibleProvider('openai', 'OpenAI'))
getOrCreate('groq',         () => new OpenAICompatibleProvider('groq', 'Groq', false))
getOrCreate('mistral',      () => new OpenAICompatibleProvider('mistral', 'Mistral AI', false))
getOrCreate('google-gemini',() => new OpenAICompatibleProvider('google-gemini', 'Google Gemini'))
getOrCreate('together',     () => new OpenAICompatibleProvider('together', 'Together AI', false))
getOrCreate('openrouter',   () => new OpenAICompatibleProvider('openrouter', 'OpenRouter', false))
getOrCreate('deepseek',     () => new OpenAICompatibleProvider('deepseek', 'DeepSeek', false))
getOrCreate('xai',          () => new OpenAICompatibleProvider('xai', 'xAI (Grok)', false))
getOrCreate('cerebras',     () => new OpenAICompatibleProvider('cerebras', 'Cerebras', false))
getOrCreate('sambanova',    () => new OpenAICompatibleProvider('sambanova', 'SambaNova Cloud', false))
getOrCreate('perplexity',   () => new OpenAICompatibleProvider('perplexity', 'Perplexity', false))
getOrCreate('fireworks',    () => new OpenAICompatibleProvider('fireworks', 'Fireworks AI', false))
getOrCreate('deepinfra',    () => new OpenAICompatibleProvider('deepinfra', 'Deepinfra', false))
getOrCreate('cohere',       () => new OpenAICompatibleProvider('cohere', 'Cohere'))
getOrCreate('nvidia-nim',   () => new OpenAICompatibleProvider('nvidia-nim', 'Nvidia NIM', false))
getOrCreate('lm-studio',    () => new OpenAICompatibleProvider('lm-studio', 'LM Studio', false))
getOrCreate('ollama',       () => new OllamaProvider())

/** Register a user-defined custom provider at runtime */
export function registerCustomProvider(config: AIProviderConfig): void {
  const instance = new OpenAICompatibleProvider(config.id, config.name, false)
  PROVIDER_INSTANCES.set(config.id, instance)
}
