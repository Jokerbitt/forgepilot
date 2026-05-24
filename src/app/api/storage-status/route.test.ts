/**
 * @vitest-environment node
 *
 * Tests for GET /api/storage-status
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Storage config mock ────────────────────────────────────────────────────────

const getStorageStatus = vi.fn<[], { mode: string; hasDatabase: boolean }>()

vi.mock('@/lib/storage/cutover-config', () => ({ getStorageStatus }))

const mockInventory = {
  stores: [],
  summary: { total: 0, postgresActive: 0, jsonOnly: 0, dualWrite: 0, highRiskJsonStores: 0, cutoverReadinessScore: 0 },
}
vi.mock('@/lib/storage/store-inventory', () => ({ getStoreInventory: vi.fn(() => mockInventory) }))

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/storage-status', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns storage status', async () => {
    getStorageStatus.mockReturnValueOnce({ mode: 'json', hasDatabase: false })
    const { GET } = await import('./route')
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json() as { mode: string; hasDatabase: boolean }
    expect(body.mode).toBe('json')
    expect(body.hasDatabase).toBe(false)
  })

  it('reflects database mode when configured', async () => {
    getStorageStatus.mockReturnValueOnce({ mode: 'postgres', hasDatabase: true })
    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json() as { mode: string; hasDatabase: boolean }
    expect(body.mode).toBe('postgres')
    expect(body.hasDatabase).toBe(true)
  })
})
