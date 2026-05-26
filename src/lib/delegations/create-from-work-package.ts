import { execSync } from 'child_process'
import { randomUUID } from 'crypto'
import type { Delegation, ExecutionRoute } from '@/lib/models/delegation'
import type { WorkPackage } from '@/lib/models/milestone'
import { createDelegationRepository, SINGLE_TENANT_USER_ID } from '@/lib/repositories/delegationRepository'

function resolveDefaultExecutionRoute(): ExecutionRoute {
  try {
    execSync('claude --version', { stdio: 'ignore', timeout: 3000 })
    return 'local-agent'
  } catch {
    return 'ollama-agent'
  }
}

export async function createDelegationFromWorkPackage(wp: WorkPackage): Promise<Delegation> {
  const now = new Date().toISOString()
  const maxBudgetUsd = Math.max(1.0, wp.estimatedHours * 0.5)
  const branchStrategy = wp.riskClass === 'C' ? 'fix' : 'feature'
  const taskType = wp.tags.includes('test') ? 'bugfix' : 'feature'

  const delegation: Delegation = {
    id: randomUUID(),
    title: wp.title,
    contract: {
      id: randomUUID(),
      workItemId: wp.id,
      goal: wp.description,
      context: '',
      taskType,
      definitionOfDone: wp.definitionOfDone,
      riskClass: wp.riskClass,
      maxBudgetUsd,
      allowedTools: ['bash', 'read_file', 'write_file'],
      branchStrategy,
      requiresApproval: wp.riskClass === 'C',
      privacyMode: 'local',
      createdAt: now,
    },
    status: 'pending',
    executionRoute: resolveDefaultExecutionRoute(),
    costEstimateUsd: 0,
    briefId: wp.briefId,
    logs: [{
      timestamp: now,
      type: 'info',
      message: `Delegation aus Work Package "${wp.title}" erstellt (Risk ${wp.riskClass}, ${wp.estimatedHours}h geschätzt)`,
    }],
    createdAt: now,
    updatedAt: now,
  }

  const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
  return repo.create(delegation)
}
