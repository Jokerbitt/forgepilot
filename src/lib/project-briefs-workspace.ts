import type { ProjectBrief } from '@/lib/models/project-brief'

export type WorkspaceBrief = {
  id: string
  title: string
  problemStatement: string
  status: ProjectBrief['status']
  statusLabel: string
  readiness: number
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  nextAction: string
  acceptedRequirements: number
  pendingRequirements: number
  totalRequirements: number
  delegationCount: number
  updatedAtLabel: string
}

const STATUS_LABELS: Record<ProjectBrief['status'], string> = {
  draft: 'Entwurf',
  in_review: 'In Review',
  accepted: 'Freigegeben',
  archived: 'Archiviert',
}

export function buildProjectBriefsWorkspaceViewModel(briefs: ProjectBrief[], now = new Date()) {
  const active = briefs.filter(brief => brief.status !== 'archived')
  const archived = briefs.filter(brief => brief.status === 'archived')
  const reviewCount = active.filter(brief => brief.status === 'in_review').length
  const acceptedCount = active.filter(brief => brief.status === 'accepted').length
  const delegatedCount = active.filter(brief => (brief.delegationIds?.length ?? 0) > 0).length
  const openRiskCount = active.filter(brief => brief.risks.some(risk => risk.isOpenAssumption || risk.impact === 'high')).length
  const sortedActive = [...active].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const nextBrief = sortedActive.find(brief => brief.status === 'in_review') ?? sortedActive[0]

  return {
    metrics: {
      active: active.length,
      reviewCount,
      acceptedCount,
      delegatedCount,
      openRiskCount,
    },
    nextAction: nextBrief
      ? {
          title: nextActionForBrief(nextBrief),
          description: `${nextBrief.title} ist der naechste sinnvolle Fokus im Projektbrief-Workflow.`,
          href: `/project-briefs/${nextBrief.id}`,
        }
      : null,
    active: sortedActive.map(brief => toWorkspaceBrief(brief, now)),
    archived: archived.map(brief => toWorkspaceBrief(brief, now)),
  }
}

function toWorkspaceBrief(brief: ProjectBrief, now: Date): WorkspaceBrief {
  const acceptedRequirements = brief.requirements.filter(requirement => requirement.status === 'accepted').length
  const pendingRequirements = brief.requirements.filter(requirement => requirement.status === 'proposed').length
  const totalRequirements = brief.requirements.length
  const readiness = calculateReadiness(brief)

  return {
    id: brief.id,
    title: brief.title,
    problemStatement: brief.problemStatement,
    status: brief.status,
    statusLabel: STATUS_LABELS[brief.status],
    readiness,
    riskLevel: calculateRiskLevel(brief),
    nextAction: nextActionForBrief(brief),
    acceptedRequirements,
    pendingRequirements,
    totalRequirements,
    delegationCount: brief.delegationIds?.length ?? 0,
    updatedAtLabel: formatRelativeDate(brief.updatedAt, now),
  }
}

function calculateReadiness(brief: ProjectBrief): number {
  let score = 20
  if (brief.problemStatement.trim()) score += 15
  if (brief.targetAudience.trim()) score += 10
  if (brief.desiredOutcome.trim()) score += 10
  if (brief.requirements.length > 0) score += 15
  if (brief.requirements.some(requirement => requirement.status === 'accepted')) score += 10
  if (brief.risks.length > 0) score += 10
  if (brief.researchRunIds.length > 0 || brief.lastResearchRun) score += 10
  if (brief.status === 'accepted') score += 10
  return Math.min(score, 100)
}

function calculateRiskLevel(brief: ProjectBrief): WorkspaceBrief['riskLevel'] {
  if (brief.risks.some(risk => risk.impact === 'high' && risk.probability === 'high')) return 'critical'
  if (brief.risks.some(risk => risk.impact === 'high' || risk.isOpenAssumption)) return 'high'
  if (brief.risks.some(risk => risk.impact === 'medium' || risk.probability === 'medium')) return 'medium'
  return 'low'
}

function nextActionForBrief(brief: ProjectBrief): string {
  if (brief.status === 'draft') return 'Intake vervollstaendigen'
  if (brief.requirements.length === 0) return 'Requirements generieren'
  if (brief.requirements.some(requirement => requirement.status === 'proposed')) return 'Requirements pruefen'
  if (brief.risks.some(risk => risk.isOpenAssumption)) return 'Offene Annahmen klaeren'
  if (!brief.delegationIds || brief.delegationIds.length === 0) return 'Erstes Arbeitspaket delegieren'
  if (brief.status === 'accepted') return 'Umsetzung verfolgen'
  return 'Brief freigeben'
}

function formatRelativeDate(value: string, now: Date): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Datum unbekannt'
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / 86_400_000)
  if (diffDays <= 0) return 'heute aktualisiert'
  if (diffDays === 1) return 'gestern aktualisiert'
  if (diffDays < 14) return `vor ${diffDays} Tagen`
  return date.toLocaleDateString('de-DE')
}
