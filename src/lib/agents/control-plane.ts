import type { AgentProfile } from '@/lib/models/agent-profile'
import type { Delegation, TaskContract } from '@/lib/models/delegation'
import type { PMAgentResult } from '@/lib/agent-runner/pm-agent'
import { buildRetryPlan, type FailureCause } from '@/lib/delegations/retry'
import type { ScopeClaim } from './scope-lock'

type TaskSkill = NonNullable<TaskContract['skillCategory']>

export interface AgentTaskRecommendation {
  delegationId: string
  title: string
  priority: number
  riskClass: TaskContract['riskClass']
  skillCategory: TaskSkill
  suggestedAgentId: string | null
  suggestedAgentName: string | null
  reason: string
  allowedFilePatterns: string[]
}

export interface FailedDelegationRecovery {
  delegationId: string
  title: string
  workItemId: string
  executionRoute: string
  errorMessage: string | null
  failureCause: FailureCause
  shouldRetry: boolean
  retryCount: number
  maxRetries: number
  diagnosticMessage: string
  updatedAt: string
}

export interface AgentControlPlaneSummary {
  generatedAt: string
  pm: {
    hasPlan: boolean
    overallHealth: PMAgentResult['overallHealth'] | null
    summary: string | null
    stale: boolean
    lastRunAt: string | null
    blockers: string[]
    recommendations: string[]
    nextDelegations: PMAgentResult['nextDelegations']
  }
  agents: {
    total: number
    available: number
    busy: number
    local: number
    cloudOrSubscription: number
  }
  scopes: {
    active: number
    claims: ScopeClaim[]
  }
  queue: {
    pending: number
    approved: number
    running: number
    failed: number
    failedRecoveries: FailedDelegationRecovery[]
  }
  coordination: {
    recommendedParallelSlots: number
    canStartMoreWork: boolean
    blockedReason: string | null
  }
  nextDelegations: AgentTaskRecommendation[]
}

export function buildAgentControlPlaneSummary(
  agents: AgentProfile[],
  claims: ScopeClaim[],
  delegations: Delegation[],
  pmPlan: PMAgentResult | null = null,
  pmPlanStale = false,
): AgentControlPlaneSummary {
  const availableAgents = agents.filter(agent => agent.availability === 'available')
  const approved = delegations
    .filter(delegation => delegation.status === 'approved')
    .sort(byPriorityThenAge)

  const running = delegations.filter(delegation => delegation.status === 'running')
  const failed = delegations.filter(delegation => delegation.status === 'failed')
  const failedRecoveries = failed
    .sort(byNewestUpdate)
    .slice(0, 5)
    .map(buildFailedDelegationRecovery)
  const freeCapacity = Math.max(0, availableAgents.length - claims.length - running.length)
  const recommendedParallelSlots = Math.min(3, freeCapacity, approved.length)
  const blockedReason = getBlockedReason({ approvedCount: approved.length, freeCapacity, failedRecoveries })

  return {
    generatedAt: new Date().toISOString(),
    pm: {
      hasPlan: !!pmPlan,
      overallHealth: pmPlan?.overallHealth ?? null,
      summary: pmPlan?.summary ?? null,
      stale: pmPlan ? pmPlanStale : true,
      lastRunAt: pmPlan?.runAt ?? null,
      blockers: pmPlan?.blockers.slice(0, 5) ?? [],
      recommendations: pmPlan?.recommendations.slice(0, 5) ?? [],
      nextDelegations: pmPlan?.nextDelegations.slice(0, 5) ?? [],
    },
    agents: {
      total: agents.length,
      available: availableAgents.length,
      busy: agents.filter(agent => agent.availability === 'busy').length,
      local: agents.filter(agent => agent.costClass === 'free-local').length,
      cloudOrSubscription: agents.filter(agent => agent.costClass !== 'free-local').length,
    },
    scopes: {
      active: claims.length,
      claims,
    },
    queue: {
      pending: delegations.filter(delegation => delegation.status === 'pending').length,
      approved: approved.length,
      running: running.length,
      failed: failed.length,
      failedRecoveries,
    },
    coordination: {
      recommendedParallelSlots,
      canStartMoreWork: recommendedParallelSlots > 0 && failed.length === 0,
      blockedReason,
    },
    nextDelegations: approved
      .slice(0, 5)
      .map(delegation => recommendDelegation(delegation, availableAgents, claims)),
  }
}

function byPriorityThenAge(a: Delegation, b: Delegation): number {
  const priorityDelta = (b.priority ?? 0) - (a.priority ?? 0)
  if (priorityDelta !== 0) return priorityDelta
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
}

function byNewestUpdate(a: Delegation, b: Delegation): number {
  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
}

function getBlockedReason(input: {
  approvedCount: number
  freeCapacity: number
  failedRecoveries: FailedDelegationRecovery[]
}): string | null {
  if (input.failedRecoveries.length > 0) {
    const topFailure = input.failedRecoveries[0]
    const action = topFailure.shouldRetry ? 'Retry vorbereiten' : 'manuell reviewen'
    return `${input.failedRecoveries.length} fehlerhafte Delegation zuerst ${action}: ${topFailure.title} (${topFailure.failureCause}).`
  }
  if (input.approvedCount === 0) return 'Keine freigegebenen Delegationen in der Queue.'
  if (input.freeCapacity <= 0) return 'Keine freie Agenten-Kapazitaet oder Write-Scopes sind bereits belegt.'
  return null
}

function buildFailedDelegationRecovery(delegation: Delegation): FailedDelegationRecovery {
  const retryPlan = buildRetryPlan(delegation)

  return {
    delegationId: delegation.id,
    title: delegation.title || delegation.contract.goal,
    workItemId: delegation.contract.workItemId,
    executionRoute: delegation.executionRoute,
    errorMessage: delegation.errorMessage ?? null,
    failureCause: retryPlan.failureCause,
    shouldRetry: retryPlan.shouldRetry,
    retryCount: retryPlan.retryCount,
    maxRetries: retryPlan.maxRetries,
    diagnosticMessage: retryPlan.diagnosticMessage,
    updatedAt: delegation.updatedAt,
  }
}

function recommendDelegation(
  delegation: Delegation,
  agents: AgentProfile[],
  claims: ScopeClaim[],
): AgentTaskRecommendation {
  const skillCategory = delegation.contract.skillCategory ?? inferSkillCategory(delegation)
  const allowedFilePatterns = delegation.contract.allowedFilePatterns ?? inferFilePatterns(skillCategory)
  const candidates = agents
    .filter(agent => !claims.some(claim => claim.agentId === agent.id))
    .map(agent => ({
      agent,
      score: scoreAgent(agent, skillCategory, delegation),
    }))
    .sort((a, b) => b.score - a.score)

  const best = candidates[0]?.score > 0 ? candidates[0].agent : null

  return {
    delegationId: delegation.id,
    title: delegation.title,
    priority: delegation.priority ?? 0,
    riskClass: delegation.contract.riskClass,
    skillCategory,
    suggestedAgentId: best?.id ?? null,
    suggestedAgentName: best?.displayName ?? null,
    reason: best ? buildReason(best, skillCategory) : 'Kein freier Agent passt sicher zu diesem Skill.',
    allowedFilePatterns,
  }
}

function scoreAgent(agent: AgentProfile, skillCategory: TaskSkill, delegation: Delegation): number {
  if (agent.availability !== 'available') return -100

  let score = 0
  if (agent.strengths.some(strength => strength.includes(skillCategory) || skillCategory.includes(strength))) score += 4
  if (agent.preferredWorkloads.some(workload => workload.includes(skillCategory) || skillCategory.includes(workload))) score += 2
  if (agent.costClass === 'free-local') score += delegation.contract.privacyMode === 'local' ? 3 : 1
  if (agent.costClass === 'included-subscription') score += 2
  if (agent.costClass === 'metered-high' && delegation.contract.riskClass === 'A') score -= 1

  if (skillCategory === 'ui-component' && agent.role === 'frontend-saas-designer') score += 5
  if (skillCategory === 'api-route' && agent.role === 'backend-engineer') score += 5
  if (skillCategory === 'data-model' && agent.role === 'architect') score += 4
  if (skillCategory === 'test' && agent.role === 'qa-reviewer') score += 5
  if (skillCategory === 'documentation' && agent.role === 'knowledge-curator') score += 5
  if (skillCategory === 'infrastructure' && agent.role === 'devops-automation') score += 5

  return score
}

function buildReason(agent: AgentProfile, skillCategory: TaskSkill): string {
  const costHint = agent.costClass === 'free-local'
    ? 'lokal und kostenfrei'
    : agent.costClass === 'included-subscription'
    ? 'im vorhandenen Abo'
    : 'mit Kostenkontrolle'
  return `${agent.displayName} passt zu ${skillCategory.replace(/-/g, ' ')} und arbeitet ${costHint}.`
}

function inferSkillCategory(delegation: Delegation): TaskSkill {
  const text = `${delegation.title} ${delegation.contract.goal} ${delegation.contract.context}`.toLowerCase()
  if (text.includes('ui') || text.includes('react') || text.includes('page') || text.includes('dashboard')) return 'ui-component'
  if (text.includes('api') || text.includes('route') || text.includes('endpoint')) return 'api-route'
  if (text.includes('model') || text.includes('schema') || text.includes('type')) return 'data-model'
  if (text.includes('test') || text.includes('qa') || text.includes('bug')) return 'test'
  if (text.includes('docker') || text.includes('deploy') || text.includes('ci')) return 'infrastructure'
  if (text.includes('doc') || text.includes('adr') || text.includes('briefing')) return 'documentation'
  return 'refactor'
}

function inferFilePatterns(skillCategory: TaskSkill): string[] {
  switch (skillCategory) {
    case 'api-route':
      return ['src/app/api/**']
    case 'ui-component':
      return ['src/app/**/page.tsx', 'src/components/**']
    case 'data-model':
      return ['src/lib/models/**', 'src/lib/**/*.ts']
    case 'test':
      return ['src/**/*.test.ts', 'src/**/*.test.tsx']
    case 'infrastructure':
      return ['scripts/**', '.github/**', 'next.config.*']
    case 'documentation':
      return ['*.md', 'docs/**']
    case 'refactor':
      return ['src/**']
  }
}
