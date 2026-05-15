import type { GitHubConnectorConfig } from './github'
import type { LinearConnectorConfig } from './linear'
import type { ConnectorId, ConnectorConfigMap } from './registry'

type EnvMap = Record<string, string | undefined>

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
