import { describe, it, expect } from 'vitest'
import { DEFAULT_PROFILES } from './profiles'

describe('DEFAULT_PROFILES', () => {
  it('has at least one local provider', () => {
    const local = DEFAULT_PROFILES.filter(p => p.executionMode === 'local')
    expect(local.length).toBeGreaterThan(0)
  })

  it('has at least one cloud provider', () => {
    const cloud = DEFAULT_PROFILES.filter(p => p.executionMode === 'cloud')
    expect(cloud.length).toBeGreaterThan(0)
  })

  it('all profiles have unique ids', () => {
    const ids = DEFAULT_PROFILES.map(p => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('all local profiles support local-only privacy mode', () => {
    const local = DEFAULT_PROFILES.filter(p => p.executionMode === 'local')
    for (const p of local) {
      expect(p.privacyModes).toContain('local-only')
    }
  })

  it('no cloud-only profile supports local-only privacy mode', () => {
    const cloud = DEFAULT_PROFILES.filter(p => p.executionMode === 'cloud')
    for (const p of cloud) {
      expect(p.privacyModes).not.toContain('local-only')
    }
  })

  it('ollama bge-m3 profile targets embedding workload', () => {
    const bge = DEFAULT_PROFILES.find(p => p.id === 'ollama-bge-m3')
    expect(bge?.recommendedWorkloads).toContain('embedding')
  })
})
