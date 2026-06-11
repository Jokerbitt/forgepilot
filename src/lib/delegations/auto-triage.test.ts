import { describe, expect, it, vi } from 'vitest'
import { applyFailedDelegationAutoTriage } from './auto-triage'
import { buildFailedDelegationActionPlan } from './triage-actions'
import { buildFailedDelegationTriage } from './triage'
import type { Delegation } from '@/lib/models/delegation'
import type { DelegationRepository } from '@/lib/repositories/delegationRepository'

function failedDelegation(overrides: Partial<Delegation> = {}): Delegation {
  return {
    id: 'del-1',
    title: 'Provider timeout',
    status: 'failed',
    executionRoute: 'runner',
    costEstimateUsd: 1,
    errorMessage: 'Request timed out while calling provider',
    createdAt: '2026-05-28T10:00:00.000Z',
    updatedAt: '2026-05-28T10:05:00.000Z',
    contract: {
      id: 'contract-1',
      workItemId: 'JOK-193',
      goal: 'Retry failed execution',
      context: 'Original context',
      definitionOfDone: ['Retry plan exists'],
      riskClass: 'B',
      maxBudgetUsd: 1,
      allowedTools: ['read', 'write'],
      branchStrategy: 'feature',
      requiresApproval: false,
      privacyMode: 'local',
      createdAt: '2026-05-28T10:00:00.000Z',
    },
    ...overrides,
  }
}

describe('applyFailedDelegationAutoTriage', () => {
  it('previews safe retries without updating the repository', async () => {
    const repo = { update: vi.fn() } as unknown as DelegationRepository
    const failed = [failedDelegation()]
    const triage = buildFailedDelegationTriage(failed)
    const actionPlan = buildFailedDelegationActionPlan(triage)

    const result = await applyFailedDelegationAutoTriage({
      repo,
      failedDelegations: failed,
      actionPlan,
      mode: 'preview',
      now: new Date('2026-05-28T11:00:00.000Z'),
    })

    expect(result.mode).toBe('preview')
    expect(result.retried).toHaveLength(1)
    expect(repo.update).not.toHaveBeenCalled()
  })

  it('applies retry patches for safe retry candidates', async () => {
    const update = vi.fn().mockResolvedValue(null)
    const repo = { update } as unknown as DelegationRepository
    const failed = [failedDelegation()]
    const triage = buildFailedDelegationTriage(failed)
    const actionPlan = buildFailedDelegationActionPlan(triage)

    const result = await applyFailedDelegationAutoTriage({
      repo,
      failedDelegations: failed,
      actionPlan,
      mode: 'apply',
      now: new Date('2026-05-28T11:00:00.000Z'),
    })

    expect(result.mode).toBe('apply')
    expect(result.retried).toMatchObject([{ id: 'del-1', retryCount: 1 }])
    expect(update).toHaveBeenCalledWith('del-1', expect.objectContaining({
      status: 'pending',
      errorMessage: undefined,
      actualCostUsd: undefined,
    }))
    expect(update.mock.calls[0][1].logs.at(-1)).toMatchObject({
      timestamp: '2026-05-28T11:00:00.000Z',
      type: 'info',
    })
  })
})
