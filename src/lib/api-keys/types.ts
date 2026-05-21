export type LlmMode = 'auto' | 'anthropic' | 'groq' | 'ollama' | 'lmstudio'

const VALID_LLM_MODES: LlmMode[] = ['auto', 'anthropic', 'groq', 'ollama', 'lmstudio']

export function isValidLlmMode(value: unknown): value is LlmMode {
  return typeof value === 'string' && (VALID_LLM_MODES as string[]).includes(value)
}

export interface ApiKeysConfig {
  GITHUB_TOKEN?: string
  LINEAR_API_KEY?: string
  LINEAR_TEAM_ID?: string
  ANTHROPIC_API_KEY?: string
  GROQ_API_KEY?: string
  OLLAMA_BASE_URL?: string
  LM_STUDIO_BASE_URL?: string
  LLM_MODE?: LlmMode
}
