import type { Delegation } from '@/lib/models/delegation'
import { buildRetryPlan, type FailureCause } from '@/lib/delegations/retry'

export type FailedDelegationTriageCategory =
  | 'missing-feedback'
  | 'retryable'
  | 'known-cause'
  | 'human-review'

export type FailedDelegationTriageSeverity = 'critical' | 'high' | 'medium'

export interface FailedDelegationTriageItem {
  id: string
  title: string
  category: FailedDelegationTriageCategory
  severity: FailedDelegationTriageSeverity
  failureCause: FailureCause
  retryable: boolean
  recommendedAction: string
  evidence: string
  href: string
}

export interface FailedDelegationTriageSummary {
  total: number
  missingFeedback: number
  retryable: number
  knownCause: number
  needsHumanReview: number
  topItems: FailedDelegationTriageItem[]
}

const RETRYABLE_CAUSES = new Set<FailureCause>(['timeout', 'rate-limit', 'missing-dependency'])
const HUMAN_REVIEW_CAUSES = new Set<FailureCause>(['auth', 'budget-exceeded', 'max-retries', 'unclear-requirements'])

export function getDelegationFailureEvidence(delegation: Delegation): string {
  const errorLogs = (delegation.logs ?? [])
    .filter(log => log.type === 'error')
    .slice(-3)
    .map(log => log.message)

  return [
    delegation.errorMessage,
    delegation.failureFeedback,
    ...(delegation.summaryReport?.warnings ?? []),
    ...errorLogs,
  ]
    .map(value => value?.trim())
    .filter((value): value is string => Boolean(value))
    .join('\n')
    .slice(0, 500)
}

function recommendationFor(input: {
  category: FailedDelegationTriageCategory
  failureCause: FailureCause
  retryable: boolean
}): string {
  if (input.category === 'missing-feedback') {
    return 'Inspect logs or rerun with error capture before retrying; add a human-readable errorMessage.'
  }

  if (input.failureCause === 'auth') {
    return 'Fix provider/GitHub/Linear credentials or session auth, then rerun the same narrow delegation.'
  }

  if (input.failureCause === 'budget-exceeded') {
    return 'Reduce scope or explicitly approve a higher budget before retrying.'
  }

  if (input.failureCause === 'unclear-requirements') {
    return 'Rewrite the delegation contract with clearer acceptance criteria before execution.'
  }

  if (input.retryable) {
    return 'Retry once with the existing contract and preserve the previous failure evidence.'
  }

  return 'Create a small repair delegation with a narrow write scope and include this failure evidence.'
}

export function classifyFailedDelegation(delegation: Delegation): FailedDelegationTriageItem | null {
  if (delegation.status !== 'failed') return null

  const evidence = getDelegationFailureEvidence(delegation)
  const retryPlan = buildRetryPlan(delegation)

  let category: FailedDelegationTriageCategory
  let severity: FailedDelegationTriageSeverity

  if (!evidence) {
    category = 'missing-feedback'
    severity = 'high'
  } else if (retryPlan.shouldRetry && (RETRYABLE_CAUSES.has(retryPlan.failureCause) || retryPlan.failureCause === 'unknown')) {
    category = 'retryable'
    severity = 'medium'
  } else if (HUMAN_REVIEW_CAUSES.has(retryPlan.failureCause)) {
    category = 'human-review'
    severity = retryPlan.failureCause === 'auth' ? 'critical' : 'high'
  } else {
    category = 'known-cause'
    severity = 'medium'
  }

  return {
    id: delegation.id,
    title: delegation.title,
    category,
    severity,
    failureCause: retryPlan.failureCause,
    retryable: retryPlan.shouldRetry && category !== 'missing-feedback' && category !== 'human-review',
    recommendedAction: recommendationFor({
      category,
      failureCause: retryPlan.failureCause,
      retryable: retryPlan.shouldRetry,
    }),
    evidence: evidence || 'No errorMessage, failureFeedback, warning or error log found.',
    href: `/delegations/${delegation.id}`,
  }
}

export function buildFailedDelegationTriage(delegations: Delegation[]): FailedDelegationTriageSummary {
  const items = delegations
    .map(classifyFailedDelegation)
    .filter((item): item is FailedDelegationTriageItem => Boolean(item))

  const severityRank: Record<FailedDelegationTriageSeverity, number> = {
    critical: 3,
    high: 2,
    medium: 1,
  }

  const sorted = [...items].sort((a, b) => {
    const severityDelta = severityRank[b.severity] - severityRank[a.severity]
    if (severityDelta !== 0) return severityDelta
    if (a.category === 'missing-feedback' && b.category !== 'missing-feedback') return -1
    if (b.category === 'missing-feedback' && a.category !== 'missing-feedback') return 1
    return a.title.localeCompare(b.title)
  })

  return {
    total: items.length,
    missingFeedback: items.filter(item => item.category === 'missing-feedback').length,
    retryable: items.filter(item => item.category === 'retryable').length,
    knownCause: items.filter(item => item.category === 'known-cause').length,
    needsHumanReview: items.filter(item => item.category === 'human-review').length,
    topItems: sorted.slice(0, 5),
  }
}
