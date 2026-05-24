export const dynamic = 'force-dynamic'
/**
 * GET /api/projects
 *
 * Returns all projects — Project Briefs enriched with idea-history metadata
 * (run status, task count, work item count) where available.
 *
 * Projects without an idea-history entry are still returned (manually created briefs).
 */

import { NextResponse } from 'next/server'
import { readProjectBriefs } from '@/lib/project-briefs'
import { readIdeaHistory } from '@/lib/pilot/idea-history-store'
import { getRun } from '@/lib/agents/orchestrated-run'
import { readDelegations } from '@/lib/delegations/queue'
import { getMilestonesByBriefId, getWorkPackagesByBriefId } from '@/lib/knowledge/milestone-store'
import type { ProjectBrief } from '@/lib/models/project-brief'
import type { Delegation } from '@/lib/models/delegation'
import type { IdeaHistoryEntry } from '@/lib/pilot/idea-history-store'
import {
  persistenceGuidance,
  resolvePersistenceStrategy,
  resolveTargetPlatform,
  platformGuidance,
} from '@/lib/project-planning-recommendations'

type ProjectPlanStatus = 'intake' | 'planning' | 'ready' | 'in_progress' | 'attention' | 'completed'

export interface ProjectSummary {
  id: string
  title: string
  problemStatement: string
  planningMode?: ProjectBrief['planningMode']
  targetPlatform?: ProjectBrief['targetPlatform']
  platformGuidance?: string
  persistenceStrategy?: ProjectBrief['persistenceStrategy']
  persistenceGuidance?: string
  createdAt: string
  status: ProjectPlanStatus
  metrics: {
    milestones: number
    workPackages: number
    readyWorkPackages: number
    blockedWorkPackages: number
    delegations: number
    runningDelegations: number
    completedDelegations: number
    openRisks: number
    acceptedRequirements: number
  }
  progress: {
    pct: number
    completed: number
    total: number
    running: number
    failed: number
  }
  activeAgents: Array<{
    id: string
    title: string
    status: Delegation['status']
    agent: string
    route: string
    href: string
    updatedAt: string
  }>
  recentDelegations: Array<{
    id: string
    title: string
    status: Delegation['status']
    agent: string
    route: string
    href: string
    updatedAt: string
  }>
  pmPlan: {
    summary: string
    nextSteps: Array<{
      id: string
      title: string
      action: 'fix_failed' | 'monitor_running' | 'start_delegation' | 'create_delegation' | 'clarify_risk' | 'plan_work_packages'
      reason: string
      href: string
      riskClass?: string
      canAutoStart: boolean
      workPackageId?: string
      delegationId?: string
    }>
  }
  nextAction: {
    label: string
    href: string
    tone: 'neutral' | 'info' | 'success' | 'warning' | 'danger'
  }
  /** Set when created via Idea → Production pipeline */
  pipeline?: {
    idea: string
    runId: string
    runStatus: 'building' | 'running' | 'done' | 'failed'
    workItemCount: number
    taskCount: number
    doneTasks: number
  }
}

export async function GET() {
  const briefs = readProjectBriefs()
  const history = readIdeaHistory(50)
  const delegations = readDelegations()

  // Index history by briefId for O(1) lookup
  const historyByBriefId = new Map<string, IdeaHistoryEntry>()
  for (const entry of history) {
    historyByBriefId.set(entry.briefId, entry)
  }

  const projects: ProjectSummary[] = briefs.map((brief: ProjectBrief) => {
    const entry = historyByBriefId.get(brief.id)
    const plan = buildPlanningSummary(brief, delegations)
    const recommendationSource = `${brief.rawIdea ?? ''} ${brief.problemStatement ?? ''}`.trim()
    const targetPlatform = resolveTargetPlatform(recommendationSource, brief.targetPlatform ?? 'undecided', brief.customPlatformNote)
    const persistenceStrategy = resolvePersistenceStrategy(recommendationSource, brief.persistenceStrategy ?? 'recommend', targetPlatform)
    const architecture = {
      planningMode: brief.planningMode ?? 'beginner',
      targetPlatform,
      platformGuidance: brief.platformGuidance ?? platformGuidance(targetPlatform, brief.customPlatformNote),
      persistenceStrategy,
      persistenceGuidance: brief.persistenceGuidance ?? persistenceGuidance(persistenceStrategy),
    }

    if (!entry) {
      return {
        id: brief.id,
        title: brief.title,
        problemStatement: brief.problemStatement ?? '',
        ...architecture,
        createdAt: brief.createdAt ?? new Date().toISOString(),
        ...plan,
      }
    }

    // Enrich with live run data
    const run = getRun(entry.runId)
    const liveStatus: IdeaHistoryEntry['status'] = run
      ? run.status === 'done'    ? 'done'
      : run.status === 'failed' || run.status === 'aborted' ? 'failed'
      : run.status === 'running' ? 'running'
      : 'building'
      : entry.status

    const doneTasks = run ? run.tasks.filter(t => t.status === 'done').length : 0

    return {
      id: brief.id,
      title: brief.title,
      problemStatement: brief.problemStatement ?? '',
      ...architecture,
      createdAt: brief.createdAt ?? entry.createdAt,
      ...plan,
      pipeline: {
        idea: entry.idea,
        runId: entry.runId,
        runStatus: liveStatus,
        workItemCount: entry.workItemCount,
        taskCount: entry.taskCount,
        doneTasks,
      },
    }
  })

  // Sort: pipeline projects first (by createdAt desc), then manual briefs
  projects.sort((a, b) => {
    const aHasPipeline = a.pipeline ? 1 : 0
    const bHasPipeline = b.pipeline ? 1 : 0
    if (aHasPipeline !== bHasPipeline) return bHasPipeline - aHasPipeline
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  return NextResponse.json(projects)
}

function buildPlanningSummary(brief: ProjectBrief, delegations: Delegation[]) {
  const milestones = getMilestonesByBriefId(brief.id)
  const workPackages = getWorkPackagesByBriefId(brief.id)
  const linkedDelegations = delegations.filter(delegation => delegation.briefId === brief.id)
  const openRisks = (brief.risks ?? []).filter(risk => risk.isOpenAssumption || risk.impact === 'high' || risk.probability === 'high').length
  const acceptedRequirements = (brief.requirements ?? []).filter(requirement => requirement.status === 'accepted').length
  const blockedWorkPackages = workPackages.filter(wp => wp.status === 'blocked').length
  const readyWorkPackages = workPackages.filter(wp => wp.status === 'ready' || wp.status === 'backlog').length
  const completedWorkPackages = workPackages.filter(wp => wp.status === 'done').length
  const runningDelegations = linkedDelegations.filter(delegation => delegation.status === 'running').length
  const completedDelegations = linkedDelegations.filter(delegation => delegation.status === 'completed').length
  const failedDelegations = linkedDelegations.filter(delegation => delegation.status === 'failed').length

  const metrics = {
    milestones: milestones.length,
    workPackages: workPackages.length,
    readyWorkPackages,
    blockedWorkPackages,
    delegations: linkedDelegations.length,
    runningDelegations,
    completedDelegations,
    openRisks,
    acceptedRequirements,
  }

  const progressTotal = Math.max(workPackages.length, linkedDelegations.length, 1)
  const progressCompleted = workPackages.length > 0 ? completedWorkPackages : completedDelegations
  const progress = {
    pct: Math.round((progressCompleted / progressTotal) * 100),
    completed: progressCompleted,
    total: progressTotal,
    running: runningDelegations,
    failed: failedDelegations,
  }
  const activeAgents = linkedDelegations.filter(delegation => delegation.status === 'running').slice(0, 4).map(toDelegationSummary)
  const recentDelegations = [...linkedDelegations]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 6)
    .map(toDelegationSummary)
  const pmPlan = buildProjectManagerPlan({ briefId: brief.id, workPackages, linkedDelegations, failedDelegations, runningDelegations })
  const base = { metrics, progress, activeAgents, recentDelegations, pmPlan }

  if (failedDelegations > 0 || blockedWorkPackages > 0) {
    return { status: 'attention' as const, ...base, nextAction: { label: 'Blocker klaeren', href: `/delegations?briefId=${brief.id}&status=failed`, tone: 'danger' as const } }
  }
  if (workPackages.length > 0 && completedWorkPackages === workPackages.length) {
    return { status: 'completed' as const, ...base, nextAction: { label: 'Abschluss pruefen', href: `/project-briefs/${brief.id}`, tone: 'success' as const } }
  }
  if (runningDelegations > 0 || linkedDelegations.some(delegation => delegation.status === 'approved' || delegation.status === 'pending')) {
    return { status: 'in_progress' as const, ...base, nextAction: { label: 'Delegationen steuern', href: `/delegations?briefId=${brief.id}`, tone: 'info' as const } }
  }
  if (workPackages.length > 0) {
    return { status: 'ready' as const, ...base, nextAction: { label: 'Delegation erstellen', href: `/delegations?new=1&briefId=${brief.id}`, tone: 'success' as const } }
  }
  if (acceptedRequirements > 0 || milestones.length > 0) {
    return { status: 'planning' as const, ...base, nextAction: { label: 'Arbeitspakete planen', href: `/project-briefs/${brief.id}`, tone: 'warning' as const } }
  }
  return {
    status: 'intake' as const,
    ...base,
    nextAction: {
      label: openRisks > 0 ? 'Annahmen klaeren' : 'Brief schaerfen',
      href: `/project-briefs/${brief.id}`,
      tone: openRisks > 0 ? 'warning' as const : 'neutral' as const,
    },
  }
}

function toDelegationSummary(delegation: Delegation) {
  const model = delegation.contract.llmModel ?? delegation.contract.llmProvider
  const agent = model ?? routeLabel(delegation.executionRoute)
  return {
    id: delegation.id,
    title: delegation.title || delegation.contract.goal.slice(0, 80),
    status: delegation.status,
    agent,
    route: routeLabel(delegation.executionRoute),
    href: `/delegations/${delegation.id}`,
    updatedAt: delegation.updatedAt,
  }
}

function routeLabel(route: Delegation['executionRoute']): string {
  if (route === 'runner') return 'Runner'
  if (route === 'ollama-agent') return 'Ollama'
  if (route === 'local-agent') return 'Lokal'
  if (route === 'direct-chat') return 'Chat'
  if (route === 'manual') return 'Manuell'
  return route
}

function buildProjectManagerPlan(input: {
  briefId: string
  workPackages: ReturnType<typeof getWorkPackagesByBriefId>
  linkedDelegations: Delegation[]
  failedDelegations: number
  runningDelegations: number
}): ProjectSummary['pmPlan'] {
  const nextSteps: ProjectSummary['pmPlan']['nextSteps'] = []
  const linkedWorkItemIds = new Set(input.linkedDelegations.map(delegation => delegation.contract.workItemId))

  for (const delegation of input.linkedDelegations.filter(item => item.status === 'failed').slice(0, 2)) {
    nextSteps.push({ id: `fix-${delegation.id}`, title: delegation.title, action: 'fix_failed', reason: 'Diese Delegation ist fehlgeschlagen und sollte vor neuen Starts triagiert werden.', href: `/delegations/${delegation.id}`, riskClass: delegation.contract.riskClass, canAutoStart: false, delegationId: delegation.id })
  }
  for (const delegation of input.linkedDelegations.filter(item => item.status === 'running').slice(0, 2)) {
    nextSteps.push({ id: `monitor-${delegation.id}`, title: delegation.title, action: 'monitor_running', reason: 'Hier arbeitet bereits ein KI-Agent. Erst Fortschritt pruefen, bevor weitere parallele Arbeit startet.', href: `/delegations/${delegation.id}`, riskClass: delegation.contract.riskClass, canAutoStart: false, delegationId: delegation.id })
  }
  for (const delegation of input.linkedDelegations.filter(item => item.status === 'approved').slice(0, 3)) {
    nextSteps.push({ id: `start-${delegation.id}`, title: delegation.title, action: 'start_delegation', reason: 'Diese Delegation ist freigegeben und kann in einem kontrollierten Batch gestartet werden.', href: `/delegations/${delegation.id}`, riskClass: delegation.contract.riskClass, canAutoStart: delegation.contract.riskClass !== 'C', delegationId: delegation.id })
  }
  for (const wp of input.workPackages.filter(item => !linkedWorkItemIds.has(item.id)).slice(0, 4)) {
    const isRisky = wp.riskClass === 'C' || wp.status === 'blocked'
    nextSteps.push({ id: `wp-${wp.id}`, title: wp.title, action: isRisky ? 'clarify_risk' : 'create_delegation', reason: isRisky ? 'Dieses Arbeitspaket braucht zuerst Klaerung, weil Risiko oder Blocker zu hoch sind.' : 'Dieses Arbeitspaket hat noch keine Delegation und ist ein sinnvoller naechster Schritt.', href: isRisky ? `/project-briefs/${input.briefId}` : `/work-items`, riskClass: wp.riskClass, canAutoStart: !isRisky, workPackageId: wp.id })
  }
  if (nextSteps.length === 0) nextSteps.push({ id: `plan-${input.briefId}`, title: 'Arbeitspakete aus dem Plan ableiten', action: 'plan_work_packages', reason: 'Der Projektmanager braucht konkrete Arbeitspakete, bevor sinnvoll delegiert werden kann.', href: `/project-briefs/${input.briefId}`, canAutoStart: false })

  const summary = input.failedDelegations > 0 ? 'Erst Fehler beheben, dann neue Agenten starten.' : input.runningDelegations > 0 ? 'Agenten laufen bereits. Beobachten und nur kleine Batches starten.' : 'Sichere naechste Schritte sind bereit. Starte mit kleinen Delegations und pruefe danach den Fortschritt.'
  return { summary, nextSteps: nextSteps.slice(0, 5) }
}
