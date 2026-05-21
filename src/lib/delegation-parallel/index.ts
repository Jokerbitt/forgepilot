import { randomUUID } from 'crypto'
import { createDelegationRepository, SINGLE_TENANT_USER_ID } from '@/lib/repositories/delegationRepository'
import { apiLogger } from '@/lib/logger'
import type { Delegation } from '@/lib/models/delegation'

export interface ParallelSpawnInput {
  parentId: string
  subTasks: Array<{
    title: string
    goal: string
    executionRoute?: string
  }>
  riskClass?: 'A' | 'B' | 'C'
}

export interface ParallelStatus {
  parentId: string
  total: number
  completed: number
  failed: number
  pending: number
  running: number
  allDone: boolean
  anyFailed: boolean
}

/**
 * Spawn parallel sub-delegations for a parent delegation.
 * Returns the created child delegation IDs.
 */
export async function spawnParallelDelegations(
  input: ParallelSpawnInput
): Promise<string[]> {
  const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
  const groupId = randomUUID()
  const childIds: string[] = []

  for (const subTask of input.subTasks) {
    const riskClass = input.riskClass ?? 'B'
    const now = new Date().toISOString()

    const child = await repo.create({
      title: subTask.title,
      status: 'pending',
      executionRoute: (subTask.executionRoute ?? 'local-agent') as Delegation['executionRoute'],
      costEstimateUsd: 0,
      autoOrchestrate: false,
      contract: {
        id: randomUUID(),
        workItemId: `parallel-${groupId.slice(0, 8)}`,
        goal: subTask.goal,
        context: '',
        definitionOfDone: [],
        riskClass,
        maxBudgetUsd: 0,
        allowedTools: [],
        branchStrategy: 'feature',
        requiresApproval: false,
        privacyMode: 'local',
        createdAt: now,
      },
      parentId: input.parentId,
      parallelGroup: groupId,
    })

    childIds.push(child.id)
    apiLogger.info(
      { event: 'parallel.spawned', parentId: input.parentId, childId: child.id, groupId },
      'Spawned parallel sub-delegation'
    )
  }

  // Update parent with child IDs
  const parent = await repo.findById(input.parentId)
  if (parent) {
    const existingChildren = parent.childIds ?? []
    await repo.update(input.parentId, {
      childIds: [...existingChildren, ...childIds],
    })
  }

  return childIds
}

/**
 * Get the parallel execution status for a parent delegation.
 */
export async function getParallelStatus(parentId: string): Promise<ParallelStatus | null> {
  const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
  const parent = await repo.findById(parentId)
  if (!parent || !parent.childIds || parent.childIds.length === 0) return null

  const children = await Promise.all(
    parent.childIds.map(id => repo.findById(id))
  )
  const valid = children.filter((c): c is Delegation => c !== null)

  const completed = valid.filter(c => c.status === 'completed').length
  const failed = valid.filter(c => c.status === 'failed' || c.status === 'cancelled').length
  const running = valid.filter(c => c.status === 'running').length
  const pending = valid.filter(c => c.status === 'pending' || c.status === 'approved').length

  return {
    parentId,
    total: valid.length,
    completed,
    failed,
    pending,
    running,
    allDone: completed + failed === valid.length,
    anyFailed: failed > 0,
  }
}

/**
 * Check if all children are done and update parent status accordingly.
 * Called after each child completes. Never throws.
 */
export async function checkParallelCompletion(childDelegation: Delegation): Promise<void> {
  try {
    if (!childDelegation.parentId) return

    const status = await getParallelStatus(childDelegation.parentId)
    if (!status || !status.allDone) return

    const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
    const newStatus = status.anyFailed ? 'failed' : 'completed'
    const errorMsg = status.anyFailed
      ? `${status.failed}/${status.total} sub-delegations failed`
      : undefined

    await repo.update(childDelegation.parentId, {
      status: newStatus,
      ...(errorMsg ? { errorMessage: errorMsg } : {}),
    })

    apiLogger.info(
      { event: 'parallel.complete', parentId: childDelegation.parentId, status: newStatus, total: status.total },
      'Parallel execution complete'
    )
  } catch (error) {
    apiLogger.error(
      { event: 'parallel.check_error', error: error instanceof Error ? error.message : String(error) },
      'Failed to check parallel completion'
    )
  }
}
