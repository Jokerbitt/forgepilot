import type { FailedDelegationTriageItem, FailedDelegationTriageSummary } from '@/lib/delegations/triage'

export interface FailedDelegationActionPlan {
  mode: 'safe-preview'
  totalFailed: number
  recommendedBatchSize: number
  retryableIds: string[]
  needsManualReviewIds: string[]
  missingFeedbackIds: string[]
  nextAction: string
  warnings: string[]
  retryEndpoints: Array<{
    id: string
    title: string
    href: string
    method: 'POST'
  }>
}

const DEFAULT_BATCH_SIZE = 2

export function buildFailedDelegationActionPlan(
  triage: FailedDelegationTriageSummary,
  options: { batchSize?: number } = {},
): FailedDelegationActionPlan {
  const batchSize = Math.max(0, Math.min(5, options.batchSize ?? DEFAULT_BATCH_SIZE))
  const retryable = triage.topItems.filter(item => item.category === 'retryable' && item.retryable)
  const missingFeedback = triage.topItems.filter(item => item.category === 'missing-feedback')
  const manualReview = triage.topItems.filter(item => item.category === 'human-review' || item.category === 'known-cause')
  const retryBatch = retryable.slice(0, batchSize)
  const warnings: string[] = []

  if (triage.missingFeedback > 0) {
    warnings.push('Do not retry delegations without readable failure evidence; first capture errorMessage, failureFeedback or error logs.')
  }

  if (triage.needsHumanReview > 0) {
    warnings.push('Human-review failures must be fixed at the provider, auth, budget or requirements level before automation continues.')
  }

  if (triage.retryable > retryBatch.length) {
    warnings.push(`Retry only ${retryBatch.length} delegation${retryBatch.length === 1 ? '' : 's'} first, then inspect the result before continuing.`)
  }

  return {
    mode: 'safe-preview',
    totalFailed: triage.total,
    recommendedBatchSize: retryBatch.length,
    retryableIds: retryBatch.map(item => item.id),
    needsManualReviewIds: manualReview.map(item => item.id),
    missingFeedbackIds: missingFeedback.map(item => item.id),
    nextAction: buildNextAction(triage, retryBatch),
    warnings,
    retryEndpoints: retryBatch.map(item => ({
      id: item.id,
      title: item.title,
      href: `/api/delegations/${item.id}/retry`,
      method: 'POST' as const,
    })),
  }
}

function buildNextAction(
  triage: FailedDelegationTriageSummary,
  retryBatch: FailedDelegationTriageItem[],
): string {
  if (triage.total === 0) {
    return 'No failed delegations are blocking the daily assistant.'
  }

  if (retryBatch.length > 0) {
    return `Retry ${retryBatch.length} safe delegation${retryBatch.length === 1 ? '' : 's'} first, then refresh the Daily Report before starting new work.`
  }

  if (triage.missingFeedback > 0) {
    return 'Improve error capture for the failed delegations before retrying.'
  }

  if (triage.needsHumanReview > 0) {
    return 'Resolve human-review blockers first: auth, budget, max retries or unclear requirements.'
  }

  return 'Create a narrow repair delegation for the visible failure cause.'
}
