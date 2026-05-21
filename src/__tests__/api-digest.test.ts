/**
 * Tests for GET /api/digest
 *
 * The route uses DelegationRepository and KnowledgeCardRepository.
 * We mock both repositories so no real I/O is needed.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { DigestEntry } from '@/lib/models/attention'
import type { Delegation } from '@/lib/models/delegation'
import type { MemoryCard } from '@/lib/knowledge/types'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const NOW = new Date('2026-05-20T12:00:00.000Z')
const WITHIN_24H = new Date(NOW.getTime() - 2 * 60 * 60 * 1000).toISOString() // 2h ago
const OLDER = new Date(NOW.getTime() - 48 * 60 * 60 * 1000).toISOString()    // 48h ago

const DELEGATIONS: Delegation[] = [
  {
    id: 'd-1',
    status: 'completed',
    updatedAt: WITHIN_24H,
    createdAt: WITHIN_24H,
    actualCostUsd: 0.05,
    summaryReport: { prUrl: 'https://github.com/org/repo/pull/1', keyPoints: [], changes: [], timeTakenMinutes: 5 },
  } as unknown as Delegation,
  {
    id: 'd-2',
    status: 'failed',
    updatedAt: WITHIN_24H,
    createdAt: WITHIN_24H,
    actualCostUsd: 0.02,
  } as unknown as Delegation,
  {
    id: 'd-3',
    status: 'cancelled',
    updatedAt: WITHIN_24H,
    createdAt: WITHIN_24H,
  } as unknown as Delegation,
  {
    id: 'd-4',
    status: 'completed',
    updatedAt: OLDER,  // outside 24h window — should NOT be counted
    createdAt: OLDER,
  } as unknown as Delegation,
]

const KNOWLEDGE_CARDS: MemoryCard[] = [
  { id: 'k-1', type: 'learning', title: 'Card 1', body: '', sourceIds: [], tags: [], privacyClass: 'internal', confidence: 'medium', createdAt: WITHIN_24H, updatedAt: WITHIN_24H },
  { id: 'k-2', type: 'learning', title: 'Card 2', body: '', sourceIds: [], tags: [], privacyClass: 'internal', confidence: 'medium', createdAt: WITHIN_24H, updatedAt: WITHIN_24H },
  { id: 'k-3', type: 'learning', title: 'Card 3', body: '', sourceIds: [], tags: [], privacyClass: 'internal', confidence: 'medium', createdAt: OLDER, updatedAt: OLDER },
]

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockListByStatus = vi.fn().mockResolvedValue(DELEGATIONS)
const mockKnowledgeListAll = vi.fn().mockResolvedValue(KNOWLEDGE_CARDS)

vi.mock('@/lib/repositories/delegationRepository', () => ({
  createDelegationRepository: vi.fn(() => ({
    listByStatus: mockListByStatus,
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    listByProject: vi.fn(),
  })),
  SINGLE_TENANT_USER_ID: 'local-user',
}))

vi.mock('@/lib/repositories/knowledgeCardRepository', () => ({
  createKnowledgeCardRepository: vi.fn(() => ({
    listAll: mockKnowledgeListAll,
    create: vi.fn(),
    findById: vi.fn(),
    listByDelegation: vi.fn(),
    listByType: vi.fn(),
    upsert: vi.fn(),
  })),
}))

vi.mock('@/lib/attention/store', () => ({
  getOpenAttentionItems: vi.fn(() => []),
}))

// ─── Imports after mocks ──────────────────────────────────────────────────────

import { getOpenAttentionItems } from '@/lib/attention/store'
import { GET } from '@/app/api/digest/route'

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/digest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Freeze time so the 24h window is deterministic
    vi.setSystemTime(NOW)
    mockListByStatus.mockResolvedValue(DELEGATIONS)
    mockKnowledgeListAll.mockResolvedValue(KNOWLEDGE_CARDS)
    vi.mocked(getOpenAttentionItems).mockReturnValue([])
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns HTTP 200', async () => {
    const response = await GET()
    expect(response.status).toBe(200)
  })

  it('returns Content-Type application/json', async () => {
    const response = await GET()
    expect(response.headers.get('content-type')).toContain('application/json')
  })

  it('counts completed delegations within 24 h', async () => {
    const response = await GET()
    const body = await response.json() as DigestEntry
    // d-1 completed within 24h; d-4 completed but older
    expect(body.delegationsCompleted).toBe(1)
  })

  it('counts failed delegations within 24 h', async () => {
    const response = await GET()
    const body = await response.json() as DigestEntry
    expect(body.delegationsFailed).toBe(1)
  })

  it('counts cancelled delegations within 24 h', async () => {
    const response = await GET()
    const body = await response.json() as DigestEntry
    expect(body.delegationsCancelled).toBe(1)
  })

  it('collects PR URLs from recent delegations with summaryReport.prUrl', async () => {
    const response = await GET()
    const body = await response.json() as DigestEntry
    expect(body.prsCreated).toEqual(['https://github.com/org/repo/pull/1'])
  })

  it('sums actualCostUsd for recent delegations', async () => {
    const response = await GET()
    const body = await response.json() as DigestEntry
    // d-1 (0.05) + d-2 (0.02) = 0.07; d-3 has no cost; d-4 is outside window
    expect(body.totalCostUsd).toBeCloseTo(0.07)
  })

  it('counts knowledge cards created within 24 h', async () => {
    const response = await GET()
    const body = await response.json() as DigestEntry
    // 2 items within 24h, 1 older
    expect(body.newKnowledgeCards).toBe(2)
  })

  it('includes open attention item count from the store', async () => {
    vi.mocked(getOpenAttentionItems).mockReturnValue([
      { id: 'a-1' } as ReturnType<typeof getOpenAttentionItems>[0],
      { id: 'a-2' } as ReturnType<typeof getOpenAttentionItems>[0],
    ])
    const response = await GET()
    const body = await response.json() as DigestEntry
    expect(body.openAttentionItems).toBe(2)
  })

  it('includes a generatedAt ISO timestamp', async () => {
    const response = await GET()
    const body = await response.json() as DigestEntry
    expect(typeof body.generatedAt).toBe('string')
    expect(Number.isNaN(new Date(body.generatedAt).getTime())).toBe(false)
  })

  it('returns zeros when delegation repository fails', async () => {
    mockListByStatus.mockRejectedValue(new Error('DB error'))
    const response = await GET()
    expect(response.status).toBe(200)
    const body = await response.json() as DigestEntry
    expect(body.delegationsCompleted).toBe(0)
    expect(body.prsCreated).toEqual([])
    expect(body.totalCostUsd).toBe(0)
  })

  it('returns 0 knowledge cards when knowledge card repository fails', async () => {
    mockKnowledgeListAll.mockRejectedValue(new Error('DB error'))
    const response = await GET()
    const body = await response.json() as DigestEntry
    expect(body.newKnowledgeCards).toBe(0)
  })
})
