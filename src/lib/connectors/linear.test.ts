import { describe, expect, it, vi } from 'vitest'
import { getLinearConnectorHealth, linearConnectorManifest, mapLinearIssueToWorkItem } from './linear'

describe('linearConnectorManifest', () => {
  it('declares Linear as a project management connector', () => {
    expect(linearConnectorManifest.id).toBe('linear')
    expect(linearConnectorManifest.category).toBe('pm')
    expect(linearConnectorManifest.capabilities).toContain('read-items')
    expect(linearConnectorManifest.configSchema['apiKey'].type).toBe('secret')
  })
})

describe('getLinearConnectorHealth', () => {
  it('returns unconfigured when required config is missing', async () => {
    const health = await getLinearConnectorHealth({})

    expect(health.status).toBe('unconfigured')
    expect(health.errorMessage).toContain('apiKey')
    expect(health.errorMessage).toContain('teamId')
  })

  it('returns ok for a successful GraphQL health check', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { viewer: { id: 'user-1' }, team: { id: 'team-1' } } }), {
        status: 200,
      }),
    )

    const health = await getLinearConnectorHealth({ apiKey: 'lin_api_test', teamId: 'team-1' }, fetcher)

    expect(health.status).toBe('ok')
    expect(fetcher).toHaveBeenCalledWith(
      'https://api.linear.app/graphql',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('returns error for authentication failure', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('{}', { status: 401 }))

    const health = await getLinearConnectorHealth({ apiKey: 'bad', teamId: 'team-1' }, fetcher)

    expect(health.status).toBe('error')
    expect(health.errorMessage).toContain('authentication')
  })
})

describe('mapLinearIssueToWorkItem', () => {
  it('normalizes a Linear issue into a WorkItem', () => {
    const item = mapLinearIssueToWorkItem({
      id: 'issue-1',
      identifier: 'FOR-1',
      title: 'Build connector health panel',
      url: 'https://linear.app/joker/issue/FOR-1',
      priority: 2,
      state: { type: 'started' },
      project: { id: 'project-1' },
      labels: { nodes: [{ name: 'connector' }] },
      assignee: { id: 'user-1' },
      updatedAt: '2026-05-15T20:00:00Z',
      createdAt: '2026-05-15T19:00:00Z',
    })

    expect(item.source).toBe('linear')
    expect(item.type).toBe('ticket')
    expect(item.title).toBe('FOR-1: Build connector health panel')
    expect(item.status).toBe('in-progress')
    expect(item.priority).toBe(1)
    expect(item.risk).toBe('B')
  })
})
