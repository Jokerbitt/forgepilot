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

type ProjectPlanStatus = 'intake' | 'planning' | 'ready' | 'in_progress' | 'attention' | 'completed'

export interface ProjectSummary {
  id: string
  title: string
  problemStatement: string
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

    if (!entry) {
      return {
        id: brief.id,
        title: brief.title,
        problemStatement: brief.problemStatement ?? '',
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

  if (failedDelegations > 0 || blockedWorkPackages > 0) {
    return { status: 'attention' as const, metrics, nextAction: { label: 'Blocker klaeren', href: `/delegations?briefId=${brief.id}&status=failed`, tone: 'danger' as const } }
  }
  if (workPackages.length > 0 && completedWorkPackages === workPackages.length) {
    return { status: 'completed' as const, metrics, nextAction: { label: 'Abschluss pruefen', href: `/project-briefs/${brief.id}`, tone: 'success' as const } }
  }
  if (runningDelegations > 0 || linkedDelegations.some(delegation => delegation.status === 'approved' || delegation.status === 'pending')) {
    return { status: 'in_progress' as const, metrics, nextAction: { label: 'Delegationen steuern', href: `/delegations?briefId=${brief.id}`, tone: 'info' as const } }
  }
  if (workPackages.length > 0) {
    return { status: 'ready' as const, metrics, nextAction: { label: 'Delegation erstellen', href: `/delegations?new=1&briefId=${brief.id}`, tone: 'success' as const } }
  }
  if (acceptedRequirements > 0 || milestones.length > 0) {
    return { status: 'planning' as const, metrics, nextAction: { label: 'Arbeitspakete planen', href: `/project-briefs/${brief.id}`, tone: 'warning' as const } }
  }
  return {
    status: 'intake' as const,
    metrics,
    nextAction: {
      label: openRisks > 0 ? 'Annahmen klaeren' : 'Brief schaerfen',
      href: `/project-briefs/${brief.id}`,
      tone: openRisks > 0 ? 'warning' as const : 'neutral' as const,
    },
  }
}
