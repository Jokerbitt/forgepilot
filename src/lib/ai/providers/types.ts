/**
 * Universal AI Provider Interface
 *
 * Every provider (Anthropic, OpenAI, Groq, Mistral, Ollama, custom…)
 * implements this interface. Adding a new provider = one file + one
 * registration call in registry.ts.
 */

export type ProviderType =
  | 'anthropic'
  | 'openai-compatible'  // covers OpenAI, Groq, Mistral, Gemini, LM Studio, Together, Azure, custom
  | 'ollama'

export type ModelPurpose = 'fast' | 'coding' | 'embedding' | 'both'

export interface AIModelDef {
  id: string           // model identifier sent to API (e.g. 'claude-haiku-4-5')
  name: string         // human-readable label (e.g. 'Claude Haiku')
  purpose: ModelPurpose
  contextWindow?: number
  costPer1kInput?: number   // USD
  costPer1kOutput?: number  // USD
  /** True when this model is permanently free (cost = 0) */
  isFree?: boolean
}

/** Free-tier information for a provider */
export interface ProviderFreeTier {
  /** Short human-readable limit (shown as badge), e.g. "14,400 req/day" */
  limit: string
  /** Link to sign-up page */
  signupUrl: string
  /** One-liner shown in quick-setup banner */
  description?: string
}

/** Config stored in nba-settings.json under `configuredProviders` */
export interface AIProviderConfig {
  id: string             // unique, e.g. 'anthropic', 'groq', 'my-lmstudio'
  type: ProviderType
  name: string           // display name
  baseUrl?: string       // for openai-compatible custom endpoints
  apiKeyRef: string      // key name in api-keys.json (e.g. 'ANTHROPIC_API_KEY')
  models: AIModelDef[]
  enabled: boolean
  isBuiltIn: boolean     // built-in providers can't be deleted, only disabled
  dataResidency: 'eu' | 'us' | 'local' | 'unknown'
  /** Free-tier info — shown in quick-setup banners + badges */
  freeTier?: ProviderFreeTier
}

/** Active model selection (which provider+model to use per purpose) */
export interface AIModelSelection {
  fastProvider: string
  fastModel: string
  codingProvider: string
  codingModel: string
  embeddingProvider?: string
  embeddingModel?: string
}

export interface ProviderGenerateOptions {
  system: string
  prompt: string
  maxTokens: number
  model: string
  apiKey?: string
  baseUrl?: string
}

export interface ProviderGenerateResult {
  text: string
  providerId: string
  model: string
  inputTokens?: number
  outputTokens?: number
}

export interface ProviderEmbeddingResult {
  embedding: number[]
  model: string
  inputTokens?: number
}

/** The interface every provider must implement */
export interface AIProvider {
  readonly id: string
  readonly name: string
  readonly type: ProviderType
  readonly supportsEmbeddings: boolean

  generateText(options: ProviderGenerateOptions): Promise<ProviderGenerateResult>
  generateEmbedding?(text: string, options: ProviderGenerateOptions): Promise<ProviderEmbeddingResult>
  isAvailable(apiKey?: string, baseUrl?: string): Promise<boolean>
}
