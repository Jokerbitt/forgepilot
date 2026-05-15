import type { ConnectorHealth, ConnectorManifest } from './types'
import {
  getGitHubConnectorHealth,
  githubConnectorManifest,
  type GitHubConnectorConfig,
} from './github'
import {
  getLinearConnectorHealth,
  linearConnectorManifest,
  type LinearConnectorConfig,
} from './linear'

export type ConnectorId = 'linear' | 'github'

export interface ConnectorConfigMap {
  linear?: LinearConnectorConfig
  github?: GitHubConnectorConfig
}

interface RegisteredConnector<TConfig> {
  manifest: ConnectorManifest
  getHealth: (config: TConfig) => Promise<ConnectorHealth>
}

type ConnectorRegistry = {
  linear: RegisteredConnector<LinearConnectorConfig>
  github: RegisteredConnector<GitHubConnectorConfig>
}

export interface ConnectorHealthView {
  manifest: ConnectorManifest
  health: ConnectorHealth
}

export const connectorRegistry: ConnectorRegistry = {
  linear: {
    manifest: linearConnectorManifest,
    getHealth: getLinearConnectorHealth,
  },
  github: {
    manifest: githubConnectorManifest,
    getHealth: getGitHubConnectorHealth,
  },
}

export function listConnectorManifests(): ConnectorManifest[] {
  return Object.values(connectorRegistry).map((connector) => connector.manifest)
}

export function getConnectorManifest(id: ConnectorId): ConnectorManifest {
  return connectorRegistry[id].manifest
}

export async function getConnectorHealth(
  id: 'linear',
  config?: LinearConnectorConfig,
): Promise<ConnectorHealth>
export async function getConnectorHealth(
  id: 'github',
  config?: GitHubConnectorConfig,
): Promise<ConnectorHealth>
export async function getConnectorHealth(
  id: ConnectorId,
  config?: LinearConnectorConfig | GitHubConnectorConfig,
): Promise<ConnectorHealth> {
  if (id === 'linear') {
    return connectorRegistry.linear.getHealth((config ?? {}) as LinearConnectorConfig)
  }

  return connectorRegistry.github.getHealth((config ?? {}) as GitHubConnectorConfig)
}

export async function getAllConnectorHealth(configs: ConnectorConfigMap): Promise<ConnectorHealthView[]> {
  const [linearHealth, githubHealth] = await Promise.all([
    connectorRegistry.linear.getHealth(configs.linear ?? {}),
    connectorRegistry.github.getHealth(configs.github ?? {}),
  ])

  return [
    {
      manifest: connectorRegistry.linear.manifest,
      health: linearHealth,
    },
    {
      manifest: connectorRegistry.github.manifest,
      health: githubHealth,
    },
  ]
}
