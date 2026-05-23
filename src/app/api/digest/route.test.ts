import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/repositories/delegationRepository', () => ({
  SINGLE_TENANT_USER_ID: 'default',
  createDelegationRepository: vi.fn(),
}))

vi.mock('@/lib/repositories/knowledgeCardRepository', () => ({
  createKnowledgeCardRepository: vi.fn(),
}))

vi.mock('@/lib/attention/store', () => ({
  getOpenAttentionItems: vi.fn(() => []),
}))

beforeEach(() => {
  vi.resetModules()
})

const now = new Date().toISOString()

const makeRepo = (overrides?: object) => ({
  listByStatus: vi.fn().mockResolvedValue([
    {
      status: 'completed',
      createdAt: now,
      updatedAt: now,
      summaryReport: { prUrl: 'https://github.com/org/repo/pull/1' },
      actualCostUsd: 0.05,
    },
    ...((overrides as { extra?: object[] })?.extra ?? []),
  ]),
})

describe('GET /api/digest', () => {
  it('returns 200 with expected digest shape', async () => {
    const delegationMod = await import('@/lib/repositories/delegationRepository')
    const cardMod = await import('@/lib/repositories/knowledgeCardRepository')

    vi.mocked(delegationMod.createDelegationRepository).mockReturnValue(makeRepo() as unknown as ReturnType<typeof delegationMod.createDelegationRepository>)
    vi.mocked(cardMod.createKnowledgeCardRepository).mockReturnValue({
      listAll: vi.fn().mockResolvedValue([{ createdAt: now }]),
    } as unknown as ReturnType<typeof cardMod.createKnowledgeCardRepository>)

    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(typeof body.delegationsCompleted).toBe('number')
    expect(typeof body.prsCreated).toBe('object')
    expect(typeof body.totalCostUsd).toBe('number')
    expect(typeof body.newKnowledgeCards).toBe('number')
    expect(typeof body.generatedAt).toBe('string')
  })

  it('returns zeros when delegation repository throws', async () => {
    const delegationMod = await import('@/lib/repositories/delegationRepository')
    const cardMod = await import('@/lib/repositories/knowledgeCardRepository')

    vi.mocked(delegationMod.createDelegationRepository).mockReturnValue({
      listByStatus: vi.fn().mockRejectedValue(new Error('DB unavailable')),
    } as unknown as ReturnType<typeof delegationMod.createDelegationRepository>)
    vi.mocked(cardMod.createKnowledgeCardRepository).mockReturnValue({
      listAll: vi.fn().mockResolvedValue([]),
    } as unknown as ReturnType<typeof cardMod.createKnowledgeCardRepository>)

    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.delegationsCompleted).toBe(0)
    expect(body.prsCreated).toEqual([])
    expect(body.totalCostUsd).toBe(0)
  })

  it('returns newKnowledgeCards=0 when card repository throws', async () => {
    const delegationMod = await import('@/lib/repositories/delegationRepository')
    const cardMod = await import('@/lib/repositories/knowledgeCardRepository')

    vi.mocked(delegationMod.createDelegationRepository).mockReturnValue(makeRepo() as unknown as ReturnType<typeof delegationMod.createDelegationRepository>)
    vi.mocked(cardMod.createKnowledgeCardRepository).mockReturnValue({
      listAll: vi.fn().mockRejectedValue(new Error('Card store unavailable')),
    } as unknown as ReturnType<typeof cardMod.createKnowledgeCardRepository>)

    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.newKnowledgeCards).toBe(0)
  })
})
