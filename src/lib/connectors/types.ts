export type ConnectorCategory = 'pm' | 'code' | 'knowledge' | 'ai' | 'communication' | 'automation'
export type ConnectorAuthType = 'api-key' | 'oauth' | 'local-path' | 'http'
export type ConnectorHealthStatus = 'ok' | 'degraded' | 'error' | 'unconfigured'
export type ConnectorCapability =
  | 'read-items'
  | 'write-items'
  | 'read-comments'
  | 'write-comments'
  | 'read-prs'
  | 'read-ci'
  | 'read-files'
  | 'write-files'
  | 'run-agent'
  | 'trigger-workflow'

export type ConfigFieldType = 'string' | 'string-list' | 'secret' | 'url' | 'path' | 'boolean'

export interface ConfigField {
  type: ConfigFieldType
  label: string
  required: boolean
  description?: string
  placeholder?: string
}

export interface ConnectorManifest {
  id: string
  name: string
  category: ConnectorCategory
  authType: ConnectorAuthType
  capabilities: ConnectorCapability[]
  configSchema: Record<string, ConfigField>
  docsUrl?: string
}

export interface ConnectorHealth {
  connectorId: string
  status: ConnectorHealthStatus
  lastChecked: string
  errorMessage?: string
  latencyMs?: number
  rateLimit?: {
    remaining: number
    resetAt: string
  }
}
