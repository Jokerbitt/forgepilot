import { describe, it, expect, vi } from 'vitest'
import { computeSkillProfiles } from './skill-profiles'

vi.mock('@/lib/repositories/delegationRepository', () => ({
  SINGLE_TENANT_USER_ID: 'local-user',
  createDelegationRepository: () => ({
    listByStatus: vi.fn().mockResolvedValue([]),
  }),
}))

describe('computeSkillProfiles', () => {
  it('returns empty routes when no delegations', async () => {
    const report = await computeSkillProfiles()
    expect(report.routes).toHaveLength(0)
    expect(report.recommendation.bestForQuality).toBeNull()
  })

  it('has correct shape', async () => {
    const report = await computeSkillProfiles()
    expect(report).toHaveProperty('generatedAt')
    expect(report).toHaveProperty('routes')
    expect(report).toHaveProperty('recommendation')
  })
})
