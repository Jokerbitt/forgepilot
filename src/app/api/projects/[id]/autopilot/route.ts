export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { findProjectBriefById } from '@/lib/project-briefs'
import { buildStarterPlan } from '@/lib/project-starter-plan'
import {
  getMilestonesByBriefId,
  getWorkPackagesByBriefId,
  persistGeneratedPlan,
} from '@/lib/knowledge/milestone-store'
import { readDelegations } from '@/lib/delegations/queue'
import { createDelegationFromWorkPackage } from '@/lib/delegations/create-from-work-package'

type RouteParams = { params: Promise<{ id: string }> }

export async function POST(_request: Request, { params }: RouteParams) {
  const { id } = await params
  const brief = findProjectBriefById(id)
  if (!brief) {
    return NextResponse.json({ error: 'Projekt nicht gefunden' }, { status: 404 })
  }

  const actions: string[] = []
  let milestones = getMilestonesByBriefId(brief.id)
  let workPackages = getWorkPackagesByBriefId(brief.id)

  if (milestones.length === 0 || workPackages.length === 0) {
    const starterPlan = buildStarterPlan(brief)
    const persisted = persistGeneratedPlan(brief.id, starterPlan.milestones, starterPlan.workPackages)
    milestones = persisted.milestones
    workPackages = persisted.workPackages
    actions.push(`${milestones.length} Meilensteine und ${workPackages.length} Arbeitspakete lokal geplant`)
  }

  const delegations = readDelegations().filter(delegation => delegation.briefId === brief.id)
  const linkedWorkItemIds = new Set(delegations.map(delegation => delegation.contract.workItemId))
  const nextWorkPackage = workPackages.find(wp =>
    !linkedWorkItemIds.has(wp.id) &&
    (wp.status === 'ready' || wp.status === 'backlog') &&
    wp.riskClass !== 'C',
  )

  let delegationId: string | undefined
  if (nextWorkPackage) {
    const created = await createDelegationFromWorkPackage(nextWorkPackage)
    delegationId = created.id
    actions.push(`Delegation "${created.title}" vorbereitet`)
  } else if (delegations.length > 0) {
    actions.push('Bestehende Delegation gefunden - kein Duplikat erstellt')
  } else {
    actions.push('Kein sicheres Arbeitspaket fuer automatische Delegation gefunden')
  }

  return NextResponse.json({
    projectId: brief.id,
    actions,
    milestones: milestones.length,
    workPackages: workPackages.length,
    delegationId,
    nextHref: delegationId ? `/delegations/${delegationId}` : `/projects/${brief.id}`,
  })
}
