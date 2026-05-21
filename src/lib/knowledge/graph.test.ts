import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getCardWithRelated, linkCards } from './graph'

const mockRepo = {
  findById: vi.fn(),
  upsert: vi.fn(),
  listAll: vi.fn(),
  create: vi.fn(),
  listByDelegation: vi.fn(),
  listByType: vi.fn(),
}

vi.mock('@/lib/repositories/knowledgeCardRepository', () => ({
  createKnowledgeCardRepository: () => mockRepo,
}))

describe('getCardWithRelated', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns empty array when card not found', async () => {
    mockRepo.findById.mockResolvedValue(null)
    expect(await getCardWithRelated('unknown')).toHaveLength(0)
  })

  it('returns just the card when no related cards', async () => {
    mockRepo.findById.mockResolvedValue({ id: 'c1', title: 'Test', body: 'content', relatedCardIds: [] })
    const result = await getCardWithRelated('c1')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('c1')
  })

  it('returns card and related cards when relatedCardIds are set', async () => {
    mockRepo.findById
      .mockResolvedValueOnce({ id: 'c1', title: 'Card 1', body: 'body 1', relatedCardIds: ['c2'] })
      .mockResolvedValueOnce({ id: 'c2', title: 'Card 2', body: 'body 2', relatedCardIds: [] })
    const result = await getCardWithRelated('c1')
    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('c1')
    expect(result[1].id).toBe('c2')
    expect(result[1].relationship).toBe('related')
  })

  it('returns empty array on unexpected error', async () => {
    mockRepo.findById.mockRejectedValue(new Error('DB connection failed'))
    const result = await getCardWithRelated('c1')
    expect(result).toHaveLength(0)
  })
})

describe('linkCards', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns failure when cards not found', async () => {
    mockRepo.findById.mockResolvedValue(null)
    const result = await linkCards('a', 'b')
    expect(result.success).toBe(false)
  })

  it('links cards bidirectionally', async () => {
    mockRepo.findById
      .mockResolvedValueOnce({ id: 'a', title: 'A', body: '', relatedCardIds: [] })
      .mockResolvedValueOnce({ id: 'b', title: 'B', body: '', relatedCardIds: [] })
    mockRepo.upsert.mockResolvedValue({})
    const result = await linkCards('a', 'b')
    expect(result.success).toBe(true)
    expect(mockRepo.upsert).toHaveBeenCalledTimes(2)
  })

  it('does not duplicate existing links', async () => {
    mockRepo.findById
      .mockResolvedValueOnce({ id: 'a', title: 'A', body: '', relatedCardIds: ['b'] })
      .mockResolvedValueOnce({ id: 'b', title: 'B', body: '', relatedCardIds: ['a'] })
    mockRepo.upsert.mockResolvedValue({})
    const result = await linkCards('a', 'b')
    expect(result.success).toBe(true)
    // Should still call upsert for both, but with deduplicated arrays
    const firstCall = mockRepo.upsert.mock.calls[0][0]
    expect(firstCall.relatedCardIds.filter((id: string) => id === 'b')).toHaveLength(1)
  })

  it('returns failure with reason on error', async () => {
    mockRepo.findById.mockRejectedValue(new Error('timeout'))
    const result = await linkCards('a', 'b')
    expect(result.success).toBe(false)
    expect(result.reason).toBe('timeout')
  })
})
