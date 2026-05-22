import { describe, expect, it } from 'vitest'
import type { Delegation } from '@/lib/models/delegation'
import {
  buildFailedDelegationTriage,
  classifyFailedDelegation,
  getDelegationFailureEvidence,
} from './triage'

function makeDelegation(overrides: Partial<Delegation> = {}): Delegation {
  return {
    id: 'del-1',
    title: 'Failed provider run',
    status: 'failed',
    executionRoute: 'local-agent',
    costEstimateUsd: 0.1,
    createdAt: '2026-05-22T08:00:00.000Z',
    updatedAt: '2026-05-22T08:10:00.000Z',
    contract: {
      id: 'contract-1',
      workItemId: 'JOK-193',
      goal: 'Validate failure triage',
      context: 'Core reliability work',
      definitionOfDone: ['Triage is visible'],
      riskClass: 'B',
      maxBudgetUsd: 1,
      allowedTools: ['read', 'write'],
      branchStrategy: 'feature',
      requiresApproval: false,
      privacyMode: 'local',
      createdAt: '2026-05-22T08:00:00.000Z',
    },
    ...overrides,
  }
}

describe('failed delegation triage', () => {
  it('marks failed delegations without evidence as missing feedback', () => {
    const item = classifyFailedDelegation(makeDelegation())

    expect(item).toMatchObject({
      category: 'missing-feedback',
      severity: 'high',
      retryable: false,
      failureCause: 'unknown',
    })
    expect(item?.recommendedAction).toContain('error capture')
  })

  it('uses error logs and classifies retryable transient failures', () => {
    const item = classifyFailedDelegation(makeDelegation({
      logs: [
        { timestamp: '2026-05-22T08:09:00.000Z', type: 'error', message: 'ETIMEDOUT while calling local model' },
      ],
    }))

    expect(item).toMatchObject({
      category: 'retryable',
      severity: 'medium',
      retryable: true,
      failureCause: 'timeout',
    })
    expect(item?.evidence).toContain('ETIMEDOUT')
  })

  it('pulls evidence from errorMessage, feedback, warnings and error logs', () => {
    const evidence = getDelegationFailureEvidence(makeDelegation({
      errorMessage: 'TypeScript compilation failed',
      failureFeedback: 'Fix route typing',
      summaryReport: {
        keyPoints: [],
        changes: [],
        warnings: ['Build red'],
        timeTakenMinutes: 4,
      },
      logs: [
        { timestamp: '2026-05-22T08:09:00.000Z', type: 'info', message: 'Starting' },
        { timestamp: '2026-05-22T08:10:00.000Z', type: 'error', message: 'tsc failed' },
      ],
    }))

    expect(evidence).toContain('TypeScript compilation failed')
    expect(evidence).toContain('Fix route typing')
    expect(evidence).toContain('Build red')
    expect(evidence).toContain('tsc failed')
    expect(evidence).not.toContain('Starting')
  })

  it('builds a sorted fleet summary for the daily report', () => {
    const summary = buildFailedDelegationTriage([
      makeDelegation({ id: 'missing', title: 'Missing details' }),
      makeDelegation({
        id: 'auth',
        title: 'Auth failed',
        errorMessage: 'Authentication failed: invalid api key',
      }),
      makeDelegation({
        id: 'timeout',
        title: 'Provider timeout',
        errorMessage: 'Request timeout',
      }),
      makeDelegation({ id: 'ok', status: 'completed', title: 'Completed' }),
    ])

    expect(summary).toMatchObject({
      total: 3,
      missingFeedback: 1,
      retryable: 1,
      needsHumanReview: 1,
    })
    expect(summary.topItems[0].severity).toBe('critical')
    expect(summary.topItems.map(item => item.id)).not.toContain('ok')
  })
})
