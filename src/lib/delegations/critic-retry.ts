/**
 * G2: Critic Auto-Retry
 * When a delegation completes with a critic score < 70 and `autoRetryOnCriticFail` is enabled,
 * automatically create a new retry delegation with critic feedback injected into the context.
 */
import type { Delegation, CriticScore, AgentLog } from '@/lib/models/delegation'
import { createDelegationRepository, SINGLE_TENANT_USER_ID } from '@/lib/repositories/delegationRepository'
import { delegationLogger } from '@/lib/logger'

const CRITIC_RETRY_THRESHOLD = 70
const MAX_RETRIES = 2

/** Compute composite critic score (0-100). */
export function computeCompositeScore(criticScore: CriticScore): number {
  return Math.round(
    criticScore.correctness * 0.5 +
    criticScore.efficiency * 0.25 +
    criticScore.drift * 0.25,
  )
}

/** Build the critic feedback block to inject into the retry context. */
function buildCriticFeedbackBlock(criticScore: CriticScore, compositeScore: number): string {
  return `
## Previous Attempt — Critic Review (Score: ${compositeScore}/100)
The Grok critic evaluated the last run and found issues. Address these before finalizing:

- **Verdict**: ${criticScore.verdict}
- **Correctness** (${criticScore.correctness}/100): ${criticScore.correctness < 70 ? 'Needs improvement' : 'Acceptable'}
- **Efficiency** (${criticScore.efficiency}/100): ${criticScore.efficiency < 70 ? 'Code is inefficient or over-engineered' : 'Acceptable'}
- **Drift** (${criticScore.drift}/100): ${criticScore.drift < 70 ? 'Agent drifted from task scope' : 'Acceptable'}
- **Summary**: ${criticScore.summary}

Fix all issues identified above before creating the PR.
`
}

/**
 * If the delegation has autoRetryOnCriticFail enabled and the critic score is below threshold,
 * creates a new retry delegation and optionally auto-approves it.
 * Returns the new delegation ID if a retry was created, otherwise null.
 */
export async function triggerCriticRetry(
  delegation: Delegation,
  criticScore: CriticScore,
): Promise<string | null> {
  if (!delegation.contract.autoRetryOnCriticFail) return null

  const compositeScore = computeCompositeScore(criticScore)
  if (compositeScore >= CRITIC_RETRY_THRESHOLD) return null

  const retryCount = delegation.retryCount ?? 0
  if (retryCount >= MAX_RETRIES) {
    delegationLogger.warn({
      event: 'critic.retry.max_reached',
      delegationId: delegation.id,
      retryCount,
      compositeScore,
    }, 'Max retries reached — not auto-retrying')
    return null
  }

  const criticBlock = buildCriticFeedbackBlock(criticScore, compositeScore)
  const updatedContext = `${delegation.contract.context ?? ''}\n${criticBlock}`.trim()

  const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
  const retryDelegation = await repo.create({
    title: `${delegation.title ?? delegation.contract.goal.slice(0, 50)} (Retry ${retryCount + 1})`,
    contract: {
      ...delegation.contract,
      context: updatedContext,
      autoRetryOnCriticFail: true,
    },
    status: 'approved',
    executionRoute: delegation.executionRoute,
    costEstimateUsd: delegation.costEstimateUsd,
    retryCount: retryCount + 1,
    chainedFromId: delegation.id,
    priority: delegation.priority,
    briefId: delegation.briefId,
    briefTitle: delegation.briefTitle,
    tags: delegation.tags,
    logs: [{
      timestamp: new Date().toISOString(),
      type: 'info' as AgentLog['type'],
      message: `🔄 Auto-Retry ${retryCount + 1}/${MAX_RETRIES} — Critic-Score war ${compositeScore}/100 (Schwelle: ${CRITIC_RETRY_THRESHOLD})`,
    }],
  })

  delegationLogger.info({
    event: 'critic.retry.created',
    originalId: delegation.id,
    retryId: retryDelegation.id,
    compositeScore,
    retryCount: retryCount + 1,
  }, 'Critic auto-retry delegation created')

  return retryDelegation.id
}
