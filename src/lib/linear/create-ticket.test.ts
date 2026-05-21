import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./client', () => ({
  createLinearClient: vi.fn(() => null),
}))

vi.mock('@/lib/logger', () => ({
  apiLogger: { info: vi.fn(), warn: vi.fn() },
}))

describe('createLinearTicketForBrief', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns created:false when no API key configured', async () => {
    const { createLinearTicketForBrief } = await import('./create-ticket')
    const result = await createLinearTicketForBrief({ title: 'Test', description: 'desc', briefId: 'b1' })
    expect(result.created).toBe(false)
    expect(result.reason).toMatch(/not configured/i)
  })

  it('returns created:true with identifier when Linear responds', async () => {
    const { createLinearClient } = await import('./client')
    const { createLinearTicketForBrief } = await import('./create-ticket')
    vi.mocked(createLinearClient).mockReturnValueOnce({
      createIssue: vi.fn(async () => ({ id: 'i1', identifier: 'FP-42', url: 'https://linear.app/fp-42' })),
      getTeamId: vi.fn(async () => 'team-1'),
      getIssue: vi.fn(async () => null),
      closeIssue: vi.fn(async () => false),
    } as unknown as InstanceType<typeof import('./client').LinearClient>)
    const result = await createLinearTicketForBrief({ title: 'Feat', description: 'build', briefId: 'b2' })
    expect(result.created).toBe(true)
    expect(result.identifier).toBe('FP-42')
  })

  it('never throws — returns created:false on exception', async () => {
    const { createLinearClient } = await import('./client')
    const { createLinearTicketForBrief } = await import('./create-ticket')
    vi.mocked(createLinearClient).mockReturnValueOnce({
      createIssue: vi.fn(async () => { throw new Error('Network error') }),
      getTeamId: vi.fn(async () => 'team-1'),
      getIssue: vi.fn(async () => null),
      closeIssue: vi.fn(async () => false),
    } as unknown as InstanceType<typeof import('./client').LinearClient>)
    const result = await createLinearTicketForBrief({ title: 'T', description: 'd', briefId: 'b3' })
    expect(result.created).toBe(false)
    expect(result.reason).toMatch(/Network error/)
  })
})
