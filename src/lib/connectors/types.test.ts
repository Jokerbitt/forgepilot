import { describe, it, expect } from 'vitest'
import type { ConnectorManifest, ConnectorHealth, ConnectorHealthStatus, ConnectorCapability } from './types'

describe('ConnectorManifest type', () => {
  it('accepts a valid Linear connector manifest', () => {
    const manifest: ConnectorManifest = {
      id: 'linear',
      name: 'Linear',
      category: 'pm',
      authType: 'api-key',
      capabilities: ['read-items', 'write-items', 'read-comments', 'write-comments'],
      configSchema: {
        apiKey: {
          type: 'secret',
          label: 'API Key',
          required: true,
          description: 'Linear personal API key',
          placeholder: 'lin_api_...',
        },
        teamId: {
          type: 'string',
          label: 'Team ID',
          required: true,
          description: 'Linear team identifier',
        },
      },
    }
    expect(manifest.id).toBe('linear')
    expect(manifest.capabilities).toContain('read-items')
    expect(manifest.configSchema['apiKey'].type).toBe('secret')
  })

  it('accepts a GitHub connector manifest', () => {
    const manifest: ConnectorManifest = {
      id: 'github',
      name: 'GitHub',
      category: 'code',
      authType: 'api-key',
      capabilities: ['read-prs', 'read-ci', 'read-items'],
      configSchema: {
        token: {
          type: 'secret',
          label: 'Personal Access Token',
          required: true,
        },
        owner: {
          type: 'string',
          label: 'Repository Owner',
          required: true,
        },
        repo: {
          type: 'string',
          label: 'Repository Name',
          required: true,
        },
      },
    }
    expect(manifest.category).toBe('code')
  })
})

describe('ConnectorHealth type', () => {
  it('accepts ok status', () => {
    const health: ConnectorHealth = {
      connectorId: 'linear',
      status: 'ok',
      lastChecked: '2026-05-15T10:00:00Z',
      latencyMs: 120,
    }
    expect(health.status).toBe('ok')
    expect(health.latencyMs).toBe(120)
  })

  it('accepts unconfigured status without optional fields', () => {
    const health: ConnectorHealth = {
      connectorId: 'github',
      status: 'unconfigured',
      lastChecked: '2026-05-15T10:00:00Z',
    }
    expect(health.status).toBe('unconfigured')
  })

  it('accepts error status with message', () => {
    const health: ConnectorHealth = {
      connectorId: 'obsidian',
      status: 'error',
      lastChecked: '2026-05-15T10:00:00Z',
      errorMessage: 'Vault path not found: Z:\\NAS\\SecondBrain',
    }
    expect(health.errorMessage).toContain('not found')
  })

  it('covers all ConnectorHealthStatus values', () => {
    const statuses: ConnectorHealthStatus[] = ['ok', 'degraded', 'error', 'unconfigured']
    expect(statuses).toHaveLength(4)
  })

  it('covers core ConnectorCapability values', () => {
    const caps: ConnectorCapability[] = ['read-items', 'write-items', 'read-prs', 'read-ci', 'run-agent']
    expect(caps).toHaveLength(5)
  })
})
