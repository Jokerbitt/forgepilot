import fs from 'fs'
import path from 'path'
import type { GitHubConnectorConfig } from './github'
import type { LinearConnectorConfig } from './linear'
import type { ConnectorId, ConnectorConfigMap } from './registry'

type EnvMap = Record<string, string | undefined>

interface StoredApiKeys {
  GITHUB_TOKEN?: string
  LINEAR_API_KEY?: string
  ANTHROPIC_API_KEY?: string
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
    LINEAR_TEAM_ID: env['LINEAR_TEAM_ID'],
    GITHUB_TOKEN: env['GITHUB_TOKEN'] ?? stored.GITHUB_TOKEN,
    GITHUB_OWNER: env['GITHUB_OWNER'],
    GITHUB_REPOSITORY_OWNER: env['GITHUB_REPOSITORY_OWNER'],
    GITHUB_REPOSITORIES: env['GITHUB_REPOSITORIES'],
    GITHUB_REPO: env['GITHUB_REPO'],
    ANTHROPIC_API_KEY: env['ANTHROPIC_API_KEY'] ?? stored.ANTHROPIC_API_KEY,
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
