export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { createProjectBriefRepository } from '@/lib/repositories/projectBriefRepository'
import {
  createDelegationRepository,
  SINGLE_TENANT_USER_ID,
} from '@/lib/repositories/delegationRepository'
import { buildTodoWebAppDemoRun } from '@/lib/demo-runs/todo-webapp'
import { recordRuntimeExecuteLoopEvidence } from '@/lib/reports/execute-loop-runtime-evidence'
import { logAuditEvent } from '@/lib/audit'

export async function POST() {
  const authError = await requireAuth()
  if (authError) return authError

  const demoRun = buildTodoWebAppDemoRun()
  const briefRepo = createProjectBriefRepository(SINGLE_TENANT_USER_ID)
  const delegationRepo = createDelegationRepository(SINGLE_TENANT_USER_ID)

  const brief = await briefRepo.create(demoRun.brief)
  const delegation = await delegationRepo.create(demoRun.delegation)
  await briefRepo.update(brief.id, { delegationIds: [delegation.id], status: 'accepted' })

  const evidence = recordRuntimeExecuteLoopEvidence(delegation, {
    tests: true,
    critic: true,
    writeback: true,
    notes: 'First Real App Run demo: ProjectBrief, Delegation, Live Logs and testable ToDo Planner page were created from the app.',
  })

  logAuditEvent({
    action: 'delegation.completed',
    entityId: delegation.id,
    entityType: 'delegation',
    entityTitle: delegation.title,
    actor: 'system',
  })

  return NextResponse.json({
    ok: true,
    title: delegation.title,
    projectId: brief.id,
    delegationId: delegation.id,
    projectHref: `/projects/${brief.id}`,
    delegationHref: `/delegations/${delegation.id}`,
    liveHref: '/live',
    appPreviewHref: demoRun.appPreviewHref,
    evidence,
    nextAction: 'Oeffne die Delegation, pruefe Logs und starte danach den echten Runner-PR fuer die ToDo WebApp.',
  }, { status: 201 })
}
