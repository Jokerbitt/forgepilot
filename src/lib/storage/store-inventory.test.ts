import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock isDatabaseConfigured and getStorageMode before importing the module
vi.mock('@/db/index', () => ({ isDatabaseConfigured: vi.fn(() => false) }))
vi.mock('./cutover-config', () => ({ getStorageMode: vi.fn(() => 'json') }))

import { getStoreInventory } from './store-inventory'
import { isDatabaseConfigured } from '@/db/index'
import { getStorageMode } from './cutover-config'

describe('getStoreInventory', () => {
  beforeEach(() => {
    vi.mocked(isDatabaseConfigured).mockReturnValue(false)
    vi.mocked(getStorageMode).mockReturnValue('json')
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('returns all expected stores', () => {
    const { stores } = getStoreInventory()
    const keys = stores.map(s => s.key)
    expect(keys).toContain('delegations')
    expect(keys).toContain('project-briefs')
    expect(keys).toContain('knowledge-cards')
    expect(keys).toContain('notifications')
    expect(keys).toContain('orchestrated-runs')
    expect(keys).toContain('processing-ledger')
    expect(keys).toContain('api-keys')
  })

  it('in json mode without DB: all postgres-ready stores show json mode', () => {
    const { stores } = getStoreInventory()
    const delegations = stores.find(s => s.key === 'delegations')!
    expect(delegations.mode).toBe('json')
  })

  it('in json mode without DB: api-keys is json-intentional', () => {
    const { stores } = getStoreInventory()
    const apiKeys = stores.find(s => s.key === 'api-keys')!
    expect(apiKeys.mode).toBe('json-intentional')
  })

  it('with DATABASE_URL and postgres mode: postgres-ready stores show postgres', () => {
    vi.mocked(isDatabaseConfigured).mockReturnValue(true)
    vi.mocked(getStorageMode).mockReturnValue('postgres')
    const { stores } = getStoreInventory()
    const briefs = stores.find(s => s.key === 'project-briefs')!
    expect(briefs.mode).toBe('postgres')
  })

  it('summary counts match store list', () => {
    const { stores, summary } = getStoreInventory()
    expect(summary.total).toBe(stores.length)
    const jsonCount = stores.filter(s => s.mode === 'json').length
    expect(summary.jsonOnly).toBe(jsonCount)
  })

  it('cutoverReadinessScore is 0 when all critical stores are json', () => {
    const { summary } = getStoreInventory()
    // In pure json mode with no DB, score should be 0
    expect(summary.cutoverReadinessScore).toBe(0)
  })

  it('every store has required fields', () => {
    const { stores } = getStoreInventory()
    for (const store of stores) {
      expect(store.key).toBeTruthy()
      expect(store.label).toBeTruthy()
      expect(store.filePath).toMatch(/^config\//)
      expect(store.note).toBeTruthy()
      expect(['json', 'postgres', 'dual', 'json-intentional']).toContain(store.mode)
      expect(['high', 'medium', 'low', 'none']).toContain(store.productionRisk)
    }
  })

  it('identifies high-risk json stores', () => {
    const { summary, stores } = getStoreInventory()
    const highRisk = stores.filter(s => s.mode === 'json' && s.productionRisk === 'high')
    expect(summary.highRiskJsonStores).toBe(highRisk.length)
    expect(highRisk.length).toBeGreaterThan(0)  // orchestrated-runs and processing-ledger
  })
})
