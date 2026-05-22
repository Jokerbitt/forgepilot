import { describe, expect, it } from 'vitest'
import type { FailedDelegationTriageSummary } from '@/lib/delegations/triage'
import { buildFailedDelegationActionPlan } from './triage-actions'

function item(overrides: Partial<FailedDelegationTriageSummary['topItems'][number]>) {
  return {
    id: 'del-1',
    title: 'Retryable timeout',
    category: 'retryable' as const,
    severity: 'medium' as const,
    failureCause: 'timeout' as const,
    retryable: true,
    recommendedAction: 'Retry once.',
    evidence: 'ETIMEDOUT',
    href: '/delegations/del-1',
    ...overrides,
  }
}

describe('failed delegation action plan', () => {
  it('builds a safe retry batch from retryable triage items', () => {
    const plan = buildFailedDelegationActionPlan({
      total: 3,
      missingFeedback: 0,
      retryable: 3,
      knownCause: 0,
      needsHumanReview: 0,
      topItems: [
        item({ id: 'del-1', title: 'Timeout one' }),
        item({ id: 'del-2', title: 'Timeout two' }),
        item({ id: 'del-3', title: 'Timeout three' }),
      ],
    })

    expect(plan.mode).toBe('safe-preview')
    expect(plan.recommendedBatchSize).toBe(2)
    expect(plan.retryableIds).toEqual(['del-1', 'del-2'])
    expect(plan.retryEndpoints).toEqual([
      { id: 'del-1', title: 'Timeout one', href: '/api/delegations/del-1/retry', method: 'POST' },
      { id: 'del-2', title: 'Timeout two', href: '/api/delegations/del-2/retry', method: 'POST' },
    ])
    expect(plan.nextAction).toContain('Retry 2 safe delegations first')
    expect(plan.warnings.join('\n')).toContain('Retry only 2')
  })

  it('blocks blind retry when evidence is missing', () => {
    const plan = buildFailedDelegationActionPlan({
      total: 1,
      missingFeedback: 1,
      retryable: 0,
      knownCause: 0,
      needsHumanReview: 0,
      topItems: [
        item({
          id: 'missing',
          title: 'Missing details',
          category: 'missing-feedback',
          retryable: false,
          failureCause: 'unknown',
        }),
      ],
    })

    expect(plan.retryableIds).toEqual([])
    expect(plan.missingFeedbackIds).toEqual(['missing'])
    expect(plan.nextAction).toContain('Improve error capture')
    expect(plan.warnings.join('\n')).toContain('Do not retry')
  })
})
