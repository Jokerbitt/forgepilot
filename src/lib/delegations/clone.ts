import type { Delegation } from '@/lib/models/delegation'
import type { CreateDelegationInput } from '@/lib/repositories/delegationRepository'

export function buildClonedDelegation(source: Delegation): CreateDelegationInput {
  const now = new Date().toISOString()
  return {
    title: `${source.title} (Kopie)`,
    status: 'pending',
    executionRoute: source.executionRoute,
    costEstimateUsd: source.costEstimateUsd,
    contract: {
      ...source.contract,
      id: crypto.randomUUID(),
      createdAt: now,
    },
    briefId: source.briefId,
    briefTitle: source.briefTitle,
    priority: source.priority,
    createdAt: now,
    updatedAt: now,
  }
}
