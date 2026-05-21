import { describe, it, expect, vi } from 'vitest'
import { GET } from './route'

vi.mock('@/lib/repositories/delegationRepository', () => ({
  SINGLE_TENANT_USER_ID: 'local-user',
  createDelegationRepository: () => ({
    listByStatus: vi.fn().mockResolvedValue([]),
  }),
}))

describe('GET /api/analytics', () => {
  it('returns analytics data', async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json() as { summary: { totalExecutions: number } }
    expect(data.summary.totalExecutions).toBe(0)
  })
})
