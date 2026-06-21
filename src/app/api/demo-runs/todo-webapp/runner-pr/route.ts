export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import {
  createDelegationRepository,
  SINGLE_TENANT_USER_ID,
} from '@/lib/repositories/delegationRepository'
import { buildTodoWebAppRunnerPrDelegation } from '@/lib/demo-runs/todo-webapp'
import { logAuditEvent } from '@/lib/audit'

interface RunnerPrRequest {
  execute?: boolean
  briefId?: string
}

function isReusableRunnerProof(status: string): boolean {
  return status === 'approved' || status === 'running'
}

export async function POST(request: NextRequest) {
  const authError = await requireAuth()
  if (authError) return authError

  const body = await request.json().catch(() => ({})) as RunnerPrRequest
  const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
  const existing = (await repo.listByStatus())
    .find(delegation =>
      delegation.tags?.includes('runner-pr-proof')
      && delegation.tags?.includes('todo-webapp')
      && isReusableRunnerProof(delegation.status)
    )

  const delegation = existing ?? await repo.create(buildTodoWebAppRunnerPrDelegation(new Date(), { briefId: body.briefId }))

  if (!existing) {
    logAuditEvent({
      action: 'delegation.created',
      entityId: delegation.id,
      entityType: 'delegation',
      entityTitle: delegation.title,
      actor: 'system',
      metadata: { source: 'todo-webapp-runner-pr-proof' },
    })
  }

  let execution: { started?: boolean; mode?: string; error?: string } | null = null

  if (body.execute && delegation.status === 'approved') {
    const executeUrl = new URL(`/api/delegations/${delegation.id}/execute`, request.url)
    const res = await fetch(executeUrl, {
      method: 'POST',
      headers: {
        cookie: request.headers.get('cookie') ?? '',
      },
    })
    execution = await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { started?: boolean; mode?: string; error?: string }
  }

  const responseStatus = execution?.started ? 'running' : delegation.status
  const nextAction = execution?.started || responseStatus === 'running'
    ? 'Runner laeuft. Beobachte Live View, Logs, PR-Link und Critic-Ergebnis.'
    : 'Oeffne die Delegation und starte den Runner, sobald du bereit bist.'

  return NextResponse.json({
    ok: true,
    reused: Boolean(existing),
    delegationId: delegation.id,
    delegationHref: `/delegations/${delegation.id}`,
    liveHref: '/live',
    status: responseStatus,
    execution,
    nextAction,
  }, { status: existing ? 200 : 201 })
}
