export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import {
  describeDeliveryAction,
  pickNextDeliveryAction,
  type DeliveryCycleAction,
} from '@/lib/daily-assistant/delivery-cycle'
import {
  createDelegationRepository,
  SINGLE_TENANT_USER_ID,
} from '@/lib/repositories/delegationRepository'
import { ensureRepairDelegation } from '@/lib/daily-assistant/repair-delegation'

interface DeliveryCycleRequest {
  dryRun?: boolean
  force?: boolean
}

function internalBaseUrl(): string {
  return process.env.FORGEPILOT_INTERNAL_BASE_URL
    ?? process.env.NEXTAUTH_URL
    ?? process.env.NEXT_PUBLIC_APP_URL
    ?? 'http://localhost:3026'
}

function actionPayload(action: DeliveryCycleAction | null) {
  if (!action) return null
  return {
    type: action.type,
    reason: action.reason,
    delegation: {
      id: action.delegation.id,
      title: action.delegation.title || action.delegation.contract.goal,
      href: `/delegations/${action.delegation.id}`,
      riskClass: action.delegation.contract.riskClass,
      status: action.delegation.status,
      prUrl: action.delegation.summaryReport?.prUrl,
    },
  }
}

async function postInternal(path: string, request: NextRequest, body?: unknown) {
  const url = new URL(path, internalBaseUrl())
  return fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie: request.headers.get('cookie') ?? '',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

export async function POST(request: NextRequest) {
  const authError = await requireAuth()
  if (authError) return authError

  const body = await request.json().catch(() => ({})) as DeliveryCycleRequest
  const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
  const delegations = await repo.listByStatus()
  const action = pickNextDeliveryAction(delegations)

  if (!action) {
    return NextResponse.json({
      ok: true,
      status: 'idle',
      message: describeDeliveryAction(null),
      action: null,
      executed: false,
    })
  }

  if (body.dryRun || (!body.force && action.type !== 'quality_check' && action.type !== 'critic_review')) {
    return NextResponse.json({
      ok: true,
      status: action.type === 'repair_required' ? 'blocked' : 'ready',
      message: describeDeliveryAction(action),
      action: actionPayload(action),
      executed: false,
    })
  }

  if (action.type === 'repair_required') {
    if (body.force) {
      const repair = await ensureRepairDelegation(repo, action.delegation)
      return NextResponse.json({
        ok: true,
        status: repair.created ? 'repair_created' : 'repair_exists',
        message: repair.created
          ? 'Repair-Delegation wurde aus dem Delivery-Gate erstellt.'
          : 'Repair-Delegation existiert bereits; keine Duplikate erzeugt.',
        action: actionPayload(action),
        repairDelegation: {
          id: repair.delegation.id,
          title: repair.delegation.title || repair.delegation.contract.goal,
          href: `/delegations/${repair.delegation.id}`,
          status: repair.delegation.status,
          riskClass: repair.delegation.contract.riskClass,
        },
        executed: repair.created,
      })
    }

    return NextResponse.json({
      ok: true,
      status: 'blocked',
      message: action.reason,
      action: actionPayload(action),
      executed: false,
    })
  }

  const id = encodeURIComponent(action.delegation.id)
  let response: Response

  if (action.type === 'quality_check') {
    response = await postInternal(`/api/delegations/${id}/quality-check`, request)
  } else if (action.type === 'critic_review') {
    const output = JSON.stringify(action.delegation.summaryReport ?? {
      keyPoints: [action.delegation.contract.goal],
      changes: action.delegation.contract.definitionOfDone,
    })
    response = await postInternal(`/api/delegations/${id}/critic-review`, request, {
      type: 'delegation',
      output,
    })
  } else if (action.type === 'create_pr') {
    response = await postInternal(`/api/delegations/${id}/create-pr`, request)
  } else {
    return NextResponse.json({
      ok: true,
      status: 'ready',
      message: describeDeliveryAction(action),
      action: actionPayload(action),
      executed: false,
    })
  }

  const result = await response.json().catch(async () => ({ raw: await response.text().catch(() => '') })) as unknown

  if (!response.ok) {
    return NextResponse.json({
      ok: false,
      status: 'step_failed',
      message: `Delivery Cycle konnte ${action.type} nicht ausfuehren.`,
      action: actionPayload(action),
      result,
      executed: false,
    }, { status: 502 })
  }

  return NextResponse.json({
    ok: true,
    status: 'executed',
    message: `${describeDeliveryAction(action)} wurde ausgefuehrt.`,
    action: actionPayload(action),
    result,
    executed: true,
  })
}
