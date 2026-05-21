import { createDelegationRepository, SINGLE_TENANT_USER_ID } from '@/lib/repositories/delegationRepository'
import { apiLogger } from '@/lib/logger'
import type { Delegation } from '@/lib/models/delegation'

/**
 * After a delegation completes successfully, check if it has a chained next delegation.
 * If autoChain is enabled on the contract, auto-approve and trigger execution.
 * Otherwise just set the next delegation to 'approved' for manual review.
 * Never throws.
 */
export async function triggerChainedDelegation(delegation: Delegation): Promise<void> {
  try {
    if (!delegation.chainNextId) return
    if (delegation.status !== 'completed') return

    const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
    const next = await repo.findById(delegation.chainNextId)
    if (!next || next.status !== 'pending') return

    const autoChain = delegation.contract?.autoChain === true

    if (autoChain) {
      // Auto-approve the next delegation
      await repo.update(delegation.chainNextId, { status: 'approved' })
      apiLogger.info(
        { event: 'chain.auto_approved', fromId: delegation.id, toId: delegation.chainNextId },
        'Chain: auto-approved next delegation'
      )
    } else {
      // Leave as pending — operator will manually approve
      apiLogger.info(
        { event: 'chain.ready', fromId: delegation.id, toId: delegation.chainNextId },
        'Chain: next delegation is ready for approval'
      )
    }
  } catch (error) {
    apiLogger.error(
      { event: 'chain.error', delegationId: delegation.id, error: error instanceof Error ? error.message : String(error) },
      'Chain trigger failed'
    )
  }
}

/**
 * Link two delegations in a chain.
 * Returns updated prev and next delegations.
 */
export async function linkDelegations(
  prevId: string,
  nextId: string,
  options: { autoChain?: boolean } = {}
): Promise<{ prev: Delegation | null; next: Delegation | null }> {
  const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)

  const [prevDelegation, nextDelegation] = await Promise.all([
    repo.findById(prevId),
    repo.findById(nextId),
  ])

  if (!prevDelegation || !nextDelegation) {
    return { prev: null, next: null }
  }

  const updatedContract = options.autoChain
    ? { ...prevDelegation.contract, autoChain: true }
    : prevDelegation.contract

  const [prev, next] = await Promise.all([
    repo.update(prevId, {
      chainNextId: nextId,
      contract: updatedContract,
    }),
    repo.update(nextId, { chainPrevId: prevId }),
  ])

  return { prev, next }
}
