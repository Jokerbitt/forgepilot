export type LlmMode = 'auto' | 'anthropic' | 'groq' | 'ollama' | 'lmstudio'
export type CriticMode = 'auto' | 'local-first' | 'cloud-first' | 'single'

const VALID_LLM_MODES: LlmMode[] = ['auto', 'anthropic', 'groq', 'ollama', 'lmstudio']
const VALID_CRITIC_MODES: CriticMode[] = ['auto', 'local-first', 'cloud-first', 'single']

export function isValidLlmMode(value: unknown): value is LlmMode {
  return typeof value === 'string' && (VALID_LLM_MODES as string[]).includes(value)
}

export function isValidCriticMode(value: unknown): value is CriticMode {
  return typeof value === 'string' && (VALID_CRITIC_MODES as string[]).includes(value)
}

export interface ApiKeysConfig {
  GITHUB_TOKEN?: string
  LINEAR_API_KEY?: string
  LINEAR_TEAM_ID?: string
  ANTHROPIC_API_KEY?: string
  OPENAI_API_KEY?: string
  XAI_API_KEY?: string
  GOOGLE_API_KEY?: string
  GROQ_API_KEY?: string
  OPENROUTER_API_KEY?: string
  MISTRAL_API_KEY?: string
  DEEPSEEK_API_KEY?: string
  OLLAMA_BASE_URL?: string
  LM_STUDIO_BASE_URL?: string
  LLM_MODE?: LlmMode
  FORGEPILOT_CRITIC_MODE?: CriticMode
  FORGEPILOT_CRITIC_PROVIDERS?: string
}
