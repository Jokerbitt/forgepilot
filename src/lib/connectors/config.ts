import fs from 'fs'
import path from 'path'
import type { GitHubConnectorConfig } from './github'
import type { LinearConnectorConfig } from './linear'
import type { ConnectorId, ConnectorConfigMap } from './registry'

type EnvMap = Record<string, string | undefined>

interface StoredApiKeys {
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
  LLM_MODE?: string
  FORGEPILOT_CRITIC_MODE?: string
  FORGEPILOT_CRITIC_PROVIDERS?: string
}

/**
 * Read API keys stored via the Settings UI (config/api-keys.json).
 * Returns empty object if file doesn't exist or is unreadable.
 */
export function readStoredApiKeys(): StoredApiKeys {
  try {
    const file = path.join(process.cwd(), 'config', 'api-keys.json')
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as StoredApiKeys
  } catch {
    return {}
  }
}

/**
 * Merge env vars with stored API keys.
 * Environment variables take precedence over stored keys.
 */
function mergedEnv(env: EnvMap): EnvMap {
  const stored = readStoredApiKeys()
  return {
    LINEAR_API_KEY: env['LINEAR_API_KEY'] ?? stored.LINEAR_API_KEY,
    LINEAR_TEAM_ID: env['LINEAR_TEAM_ID'] ?? stored.LINEAR_TEAM_ID,
    GITHUB_TOKEN: env['GITHUB_TOKEN'] ?? stored.GITHUB_TOKEN,
    GITHUB_OWNER: env['GITHUB_OWNER'],
    GITHUB_REPOSITORY_OWNER: env['GITHUB_REPOSITORY_OWNER'],
    GITHUB_REPOSITORIES: env['GITHUB_REPOSITORIES'],
    GITHUB_REPO: env['GITHUB_REPO'],
    ANTHROPIC_API_KEY: env['ANTHROPIC_API_KEY'] ?? stored.ANTHROPIC_API_KEY,
    OPENAI_API_KEY: env['OPENAI_API_KEY'] ?? stored.OPENAI_API_KEY,
    XAI_API_KEY: env['XAI_API_KEY'] ?? stored.XAI_API_KEY,
    GOOGLE_API_KEY: env['GOOGLE_API_KEY'] ?? stored.GOOGLE_API_KEY,
    GROQ_API_KEY: env['GROQ_API_KEY'] ?? stored.GROQ_API_KEY,
    OPENROUTER_API_KEY: env['OPENROUTER_API_KEY'] ?? stored.OPENROUTER_API_KEY,
    MISTRAL_API_KEY: env['MISTRAL_API_KEY'] ?? stored.MISTRAL_API_KEY,
    DEEPSEEK_API_KEY: env['DEEPSEEK_API_KEY'] ?? stored.DEEPSEEK_API_KEY,
    OLLAMA_BASE_URL: env['OLLAMA_BASE_URL'] ?? stored.OLLAMA_BASE_URL,
    LM_STUDIO_BASE_URL: env['LM_STUDIO_BASE_URL'] ?? stored.LM_STUDIO_BASE_URL,
    LLM_MODE: env['LLM_MODE'] ?? stored.LLM_MODE,
    FORGEPILOT_CRITIC_MODE: env['FORGEPILOT_CRITIC_MODE'] ?? stored.FORGEPILOT_CRITIC_MODE,
    FORGEPILOT_CRITIC_PROVIDERS: env['FORGEPILOT_CRITIC_PROVIDERS'] ?? stored.FORGEPILOT_CRITIC_PROVIDERS,
  }
}

export function readLinearConfigFromEnv(env: EnvMap): LinearConnectorConfig {
  return {
    apiKey: env['LINEAR_API_KEY'],
    teamId: env['LINEAR_TEAM_ID'],
  }
}

export function readGitHubConfigFromEnv(env: EnvMap): GitHubConnectorConfig {
  return {
    token: env['GITHUB_TOKEN'],
    owner: env['GITHUB_OWNER'] ?? env['GITHUB_REPOSITORY_OWNER'],
    repositories: parseRepositoryList(env['GITHUB_REPOSITORIES'] ?? env['GITHUB_REPO']),
  }
}

export function readConnectorConfigsFromEnv(env: EnvMap): ConnectorConfigMap {
  return {
    linear: readLinearConfigFromEnv(env),
    github: readGitHubConfigFromEnv(env),
  }
}

/**
 * Read connector configs merging process.env with config/api-keys.json.
 * Use this in API routes instead of readConnectorConfigsFromEnv(process.env)
 * so keys set via the Settings UI are picked up automatically.
 */
export function readConnectorConfigs(): ConnectorConfigMap {
  const env = mergedEnv(process.env)
  return readConnectorConfigsFromEnv(env)
}

export function parseRepositoryList(value: string | undefined): string[] | undefined {
  if (!value) {
    return undefined
  }

  const repositories = value
    .split(',')
    .map((repo) => repo.trim())
    .filter(Boolean)

  return repositories.length > 0 ? repositories : undefined
}

export function connectorIds(): ConnectorId[] {
  return ['linear', 'github']
}
