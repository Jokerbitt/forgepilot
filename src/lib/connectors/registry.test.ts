import { describe, expect, it } from 'vitest'
import {
  connectorRegistry,
  getAllConnectorHealth,
  getConnectorManifest,
  listConnectorManifests,
} from './registry'

describe('connectorRegistry', () => {
  it('contains the initial M1 connectors', () => {
    expect(Object.keys(connectorRegistry)).toEqual(['linear', 'github'])
  })

  it('lists connector manifests for onboarding UI', () => {
    const manifests = listConnectorManifests()

    expect(manifests.map((manifest) => manifest.id)).toEqual(['linear', 'github'])
    expect(getConnectorManifest('linear').category).toBe('pm')
    expect(getConnectorManifest('github').category).toBe('code')
  })

  it('aggregates health without throwing when connectors are unconfigured', async () => {
    const views = await getAllConnectorHealth({})

    expect(views).toHaveLength(2)
    expect(views.map((view) => view.health.status)).toEqual(['unconfigured', 'unconfigured'])
  })
})
