import type { Delegation } from '@/lib/models/delegation'
import type { WorkPackage } from '@/lib/models/milestone'
import type { ProjectBrief } from '@/lib/models/project-brief'

export interface ProjectSliceCandidate {
  id: string
  projectId: string
  projectTitle: string
  title: string
  riskClass: WorkPackage['riskClass']
  priority: WorkPackage['priority']
  status: WorkPackage['status']
  href: string
  reason: string
}

export interface ProjectPipelineSummary {
  projectCount: number
  workPackageCount: number
  safeSliceCount: number
  blockedByDependencyCount: number
  inFlightSliceCount: number
  completedSliceCount: number
  nextCandidate: ProjectSliceCandidate | null
  recommendation: string
}

function delegationPassed(delegation: Delegation | undefined): boolean {
  if (!delegation || delegation.status !== 'completed') return false
  if (delegation.qualityCheck && delegation.qualityCheck.verdict !== 'passed') return false
  if (delegation.criticScore && delegation.criticScore.verdict !== 'approved') return false
  return true
}

function linkedDelegations(workPackage: WorkPackage, delegations: Delegation[]): Delegation[] {
  return delegations.filter(delegation =>
    delegation.contract.workItemId === workPackage.id
    || workPackage.delegationIds.includes(delegation.id),
  )
}

function dependencySatisfied(dependency: string, workPackages: WorkPackage[], delegations: Delegation[]): boolean {
  const dependencyPackage = workPackages.find(workPackage =>
    workPackage.id === dependency || workPackage.title === dependency,
  )
  if (!dependencyPackage) return false
  return linkedDelegations(dependencyPackage, delegations).some(delegationPassed)
}

function dependenciesSatisfied(workPackage: WorkPackage, workPackages: WorkPackage[], delegations: Delegation[]): boolean {
  return workPackage.dependsOn.every(dependency => dependencySatisfied(dependency, workPackages, delegations))
}

function candidatePriorityScore(candidate: WorkPackage): number {
  const priorityScore: Record<WorkPackage['priority'], number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  }
  const riskScore: Record<WorkPackage['riskClass'], number> = { A: 0, B: 1, C: 2 }
  return priorityScore[candidate.priority] * 10 + riskScore[candidate.riskClass]
}

export function buildProjectPipelineSummary(input: {
  briefs: ProjectBrief[]
  workPackages: WorkPackage[]
  delegations: Delegation[]
}): ProjectPipelineSummary {
  const projectTitleById = new Map(input.briefs.map(brief => [brief.id, brief.title || 'Projekt']))
  const workPackages = input.workPackages.filter(workPackage => projectTitleById.has(workPackage.briefId))
  const safeCandidates = workPackages
    .filter(workPackage => ['ready', 'backlog'].includes(workPackage.status))
    .filter(workPackage => workPackage.riskClass !== 'C')
    .filter(workPackage => linkedDelegations(workPackage, input.delegations).length === 0)

  const readyCandidates = safeCandidates
    .filter(workPackage => dependenciesSatisfied(workPackage, workPackages, input.delegations))
    .sort((a, b) => candidatePriorityScore(a) - candidatePriorityScore(b))

  const nextCandidate = readyCandidates[0]
  const inFlightSliceCount = workPackages.filter(workPackage =>
    linkedDelegations(workPackage, input.delegations).some(delegation =>
      ['pending', 'approved', 'running'].includes(delegation.status),
    ),
  ).length
  const completedSliceCount = workPackages.filter(workPackage =>
    linkedDelegations(workPackage, input.delegations).some(delegationPassed),
  ).length
  const blockedByDependencyCount = safeCandidates.length - readyCandidates.length

  return {
    projectCount: input.briefs.length,
    workPackageCount: workPackages.length,
    safeSliceCount: readyCandidates.length,
    blockedByDependencyCount,
    inFlightSliceCount,
    completedSliceCount,
    nextCandidate: nextCandidate
      ? {
          id: nextCandidate.id,
          projectId: nextCandidate.briefId,
          projectTitle: projectTitleById.get(nextCandidate.briefId) ?? 'Projekt',
          title: nextCandidate.title,
          riskClass: nextCandidate.riskClass,
          priority: nextCandidate.priority,
          status: nextCandidate.status,
          href: `/projects/${nextCandidate.briefId}`,
          reason: nextCandidate.dependsOn.length > 0
            ? 'Abhaengigkeiten sind erfuellt; dieser Slice kann als naechstes vorbereitet werden.'
            : 'Kleiner sicherer Start-Slice ohne offene Abhaengigkeiten.',
        }
      : null,
    recommendation: nextCandidate
      ? `Naechster sicherer App-Slice: ${nextCandidate.title}.`
      : blockedByDependencyCount > 0
        ? 'Naechste App-Slices warten auf abgeschlossene Abhaengigkeiten.'
        : workPackages.length > 0
          ? 'Projektplan vorhanden, aber aktuell kein sicherer neuer Slice startbereit.'
          : 'Noch kein Multi-Slice-Projektplan vorhanden. Starte im Plan Mode.',
  }
}
