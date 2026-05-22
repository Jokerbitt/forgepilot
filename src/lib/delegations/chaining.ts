/**
 * M230: Delegation Chaining
 *
 * Called after a delegation completes. If the delegation has a chainConfig,
 * creates (and optionally auto-starts) the next delegation in the chain.
 *
 * Design principles:
 * - Fail-open: any error returns { created: false, skipped: true }
 * - Fire-and-forget: callers must not await or catch — never blocks the parent
 * - No `any` types
 */

import type { Delegation } from '@/lib/models/delegation'
import { createDelegationRepository, SINGLE_TENANT_USER_ID } from '@/lib/repositories/delegationRepository'

export interface ChainResult {
  created: boolean
  delegationId?: string
  skipped: boolean
  reason: string
}

/**
 * Called after a delegation completes.
 * If delegation has chainConfig, creates the next delegation.
 * If autoStart=true, also triggers execution via /api/delegations/[id]/approve + execute.
 */
export async function triggerChain(
  completedDelegation: Delegation,
  executionOutput: string,
): Promise<ChainResult> {
  try {
    const { chainConfig } = completedDelegation

    if (!chainConfig) {
      return { created: false, skipped: true, reason: 'no chainConfig' }
    }

    const { nextTitle, nextPrompt, autoStart, passOutputAs } = chainConfig

    // Build prompt — optionally prepend last 500 chars of previous output as context
    const contextSnippet =
      passOutputAs === 'context' && executionOutput.trim()
        ? `\n\n## Output from previous delegation\n${executionOutput.slice(-500)}`
        : ''

    const finalPrompt = `${nextPrompt}${contextSnippet}`

    // Inherit key fields from the parent delegation contract
    const parentContract = completedDelegation.contract

    const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)

    const created = await repo.create({
      title: nextTitle,
      status: 'pending',
      executionRoute: completedDelegation.executionRoute,
      costEstimateUsd: parentContract.maxBudgetUsd ?? 0,
      chainedFromId: completedDelegation.id,
      contract: {
        id: `chain-${Date.now()}`,
        workItemId: `chain-${completedDelegation.contract.workItemId}`,
        goal: finalPrompt,
        context: '',
        riskClass: parentContract.riskClass,
        maxBudgetUsd: parentContract.maxBudgetUsd,
        allowedTools: parentContract.allowedTools,
        branchStrategy: parentContract.branchStrategy,
        requiresApproval: !autoStart,
        privacyMode: parentContract.privacyMode,
        llmModel: parentContract.llmModel,
        outputMode: parentContract.outputMode,
        definitionOfDone: [],
        createdAt: new Date().toISOString(),
      },
    })

    // Store the chained delegation ID back on the parent
    await repo.update(completedDelegation.id, {
      chainedDelegationId: created.id,
    })

    // If autoStart: approve + execute the new delegation
    if (autoStart) {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'

      // Approve first (sets status to 'approved')
      await fetch(`${baseUrl}/api/delegations/${created.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'chain-auto-start' }),
      })

      // Fire-and-forget execution — never await, never propagate errors
      fetch(`${baseUrl}/api/delegations/${created.id}/execute`, {
        method: 'POST',
      }).catch(() => {
        // Intentionally swallowed — execution errors must not surface to the chain trigger
      })
    }

    return { created: true, delegationId: created.id, skipped: false, reason: 'chain created' }
  } catch {
    // Fail-open: any error → skipped
    return { created: false, skipped: true, reason: 'error during chain trigger' }
  }
}
