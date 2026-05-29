import type { Delegation } from '@/lib/models/delegation'
import type { AgentLog } from '@/lib/models/delegation'

export type FailureCause =
  | 'cancelled'
  | 'max-retries'
  | 'type-error'
  | 'lint-error'
  | 'test-failure'
  | 'timeout'
  | 'context-too-large'
  | 'missing-dependency'
  | 'unclear-requirements'
  | 'budget-exceeded'
  | 'turn-limit'
  | 'auth'
  | 'rate-limit'
  | 'unknown'

export interface RetryPlan {
  shouldRetry: boolean
  retryCount: number
  maxRetries: number
  maxRetriesReached: boolean
  failureCause: FailureCause
  diagnosticMessage: string
  additionalContext: string
  improvedGoal: string
  backoffMs: number
}

export type RetryDelegationPatch = Partial<Omit<Delegation, 'id' | 'createdAt'>>

const MAX_RETRIES = 3

export function countRetries(delegation: Delegation): number {
  return (delegation.logs ?? []).filter(log => {
    const message = log.message.toLowerCase()
    return message.includes('erneut eingereicht') || message.includes('retry')
  }).length
}

function combinedFailureText(delegation: Delegation): string {
  return [
    delegation.errorMessage,
    delegation.failureFeedback,
    ...(delegation.logs ?? []).slice(-10).map(log => log.message),
  ]
    .filter(Boolean)
    .join('\n')
    .toLowerCase()
}

function primaryFailureText(delegation: Delegation): string {
  return [
    delegation.errorMessage,
    delegation.failureFeedback,
    ...(delegation.logs ?? []).filter(log => log.type === 'error').slice(-5).map(log => log.message),
  ]
    .filter(Boolean)
    .join('\n')
    .toLowerCase()
}

function containsAuthFailure(text: string): boolean {
  return text.includes('authentication')
    || text.includes('invalid x-api-key')
    || text.includes('api key')
    || text.includes('api-key')
    || text.includes('oauth')
    || text.includes('unauthorized')
}

export function detectFailureCause(delegation: Delegation): FailureCause {
  if (delegation.status === 'cancelled') return 'cancelled'

  const primaryText = primaryFailureText(delegation)
  if (containsAuthFailure(primaryText)) return 'auth'

  const text = combinedFailureText(delegation)
  if (text.includes('typescript') || text.includes('type error') || text.includes('ts(') || text.includes('tsc')) return 'type-error'
  if (text.includes('eslint') || text.includes('lint')) return 'lint-error'
  if (text.includes('test') && (text.includes('fail') || text.includes('expect(') || text.includes('assertion'))) return 'test-failure'
  if (text.includes('timed out') || text.includes('timeout') || text.includes('etimedout') || text.includes('econnreset') || text.includes('socket hang up') || text.includes('zeitueberschreitung')) return 'timeout'
  if (text.includes('context window') || text.includes('token limit') || text.includes('context too large')) return 'context-too-large'
  if (text.includes('enoent') || text.includes('cannot find module') || text.includes('module not found')) return 'missing-dependency'
  if (text.includes('ambiguous') || text.includes('unclear') || text.includes('what exactly')) return 'unclear-requirements'
  if (text.includes('budget exceeded') || (text.includes('budget') && text.includes('cost'))) return 'budget-exceeded'
  if (text.includes('reached max turns') || text.includes('turn-limit') || text.includes('max turns')) return 'turn-limit'
  if (containsAuthFailure(text)) return 'auth'
  if (text.includes('rate limit') || text.includes('rate_limit')) return 'rate-limit'
  return 'unknown'
}

export function computeBackoffMs(retryCount: number): number {
  return 5_000 * Math.pow(2, retryCount)
}

function guidanceFor(cause: FailureCause): string {
  switch (cause) {
    case 'cancelled':
      return 'Die Delegation wurde bewusst abgebrochen und wird nicht automatisch erneut eingereiht.'
    case 'type-error':
      return 'TypeScript errors: run tsc --noEmit first, fix type roots, and keep the next change smaller.'
    case 'lint-error':
      return 'ESLint failed: run npm run lint, fix reported rules, and avoid unrelated formatting churn.'
    case 'test-failure':
      return 'Tests failed: run npm run test:run, inspect the first failing assertion, and fix root cause before retrying.'
    case 'timeout':
      return 'The run timed out. Split the task into smaller steps and reduce scope before retrying.'
    case 'context-too-large':
      return 'The context window was too large. Compress context and include only directly relevant files.'
    case 'missing-dependency':
      return 'A dependency or file is missing. Verify imports, paths, and npm install requirements before retrying.'
    case 'unclear-requirements':
      return 'Requirements are unclear. Restate the Definition of Done and ask for clarification if ambiguity remains.'
    case 'budget-exceeded':
      return 'Budget exceeded. Reduce acceptance criteria or request explicit budget approval before retrying.'
    case 'turn-limit':
      return 'Turn limit reached. Retry once with a slightly higher maxBudgetUsd or split the delegation into a smaller task.'
    case 'auth':
      return 'Authentication failed. Check API keys/session auth before retrying.'
    case 'rate-limit':
      return 'Rate limit reached. Wait or route to another available provider before retrying.'
    case 'max-retries':
      return 'Maximum retry count reached. Human review is required before another attempt.'
    case 'unknown':
      return 'Unknown failure. Retry is allowed, but preserve the previous error and diagnose before changing code.'
  }
}

export function buildImprovedContext(cause: FailureCause, delegation: Delegation): string {
  const previousError = delegation.errorMessage
    ? delegation.errorMessage.slice(0, 300)
    : ''

  return [
    delegation.contract.context,
    '',
    '## Retry Guidance',
    guidanceFor(cause),
    previousError ? `Previous error: ${previousError}` : '',
  ].filter(Boolean).join('\n')
}

export function buildRetryPlan(delegation: Delegation): RetryPlan {
  const retryCount = countRetries(delegation)
  const maxRetriesReached = retryCount >= MAX_RETRIES
  const failureCause = maxRetriesReached ? 'max-retries' : detectFailureCause(delegation)
  const shouldRetry =
    delegation.status === 'failed' &&
    !maxRetriesReached &&
    failureCause !== 'cancelled'

  return {
    shouldRetry,
    retryCount,
    maxRetries: MAX_RETRIES,
    maxRetriesReached,
    failureCause,
    diagnosticMessage: guidanceFor(failureCause),
    additionalContext: buildImprovedContext(failureCause, delegation),
    improvedGoal: delegation.contract.goal,
    backoffMs: computeBackoffMs(retryCount),
  }
}

export function buildRetryDelegationPatch(
  delegation: Delegation,
  plan: RetryPlan,
  now = new Date(),
): RetryDelegationPatch {
  const timestamp = now.toISOString()
  const retryLog: AgentLog = {
    timestamp,
    type: 'info',
    message: `Erneut eingereicht (Retry #${plan.retryCount + 1}) - ${plan.diagnosticMessage}`,
  }

  return {
    status: 'pending',
    startedAt: undefined,
    completedAt: undefined,
    errorMessage: undefined,
    summaryReport: undefined,
    criticScore: undefined,
    actualCostUsd: undefined,
    contract: {
      ...delegation.contract,
      context: plan.additionalContext,
    },
    logs: [...(delegation.logs ?? []), retryLog],
  }
}
