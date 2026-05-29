export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import {
  describeDeliveryAction,
  getDeliveryActionForDelegation,
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

function repairPayload(repair: Awaited<ReturnType<typeof ensureRepairDelegation>>) {
  return {
    id: repair.delegation.id,
    title: repair.delegation.title || repair.delegation.contract.goal,
    href: `/delegations/${repair.delegation.id}`,
    status: repair.delegation.status,
    riskClass: repair.delegation.contract.riskClass,
  }
}

async function postInternal(path: string, request: NextRequest, body?: unknown, timeoutMs = 90_000) {
  const url = new URL(path, internalBaseUrl())
  return fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie: request.headers.get('cookie') ?? '',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  })
}

async function executeDeliveryActionStep(action: DeliveryCycleAction, request: NextRequest): Promise<Response | null> {
  const id = encodeURIComponent(action.delegation.id)

  if (action.type === 'quality_check') {
    return postInternal(`/api/delegations/${id}/quality-check`, request)
  }

  if (action.type === 'critic_review') {
    const output = JSON.stringify(action.delegation.summaryReport ?? {
      keyPoints: [action.delegation.contract.goal],
      changes: action.delegation.contract.definitionOfDone,
    })
    return postInternal(`/api/delegations/${id}/critic-review`, request, {
      type: 'delegation',
      output,
    })
  }

  if (action.type === 'create_pr') {
    return postInternal(`/api/delegations/${id}/create-pr`, request)
  }

  return null
}

async function responseJson(response: Response): Promise<unknown> {
  return response.json().catch(async () => ({
    raw: await response.text().catch(() => ''),
  })) as Promise<unknown>
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
      const payload = repairPayload(repair)

      if (repair.delegation.status === 'running') {
        return NextResponse.json({
          ok: true,
          status: 'repair_running',
          message: 'Repair-Delegation läuft bereits.',
          action: actionPayload(action),
          repairDelegation: payload,
          executed: false,
        })
      }

      if (repair.delegation.status === 'pending') {
        return NextResponse.json({
          ok: true,
          status: repair.created ? 'repair_created_pending' : 'repair_waiting_approval',
          message: repair.created
            ? 'Repair-Delegation wurde erstellt und wartet auf Freigabe.'
            : 'Repair-Delegation wartet auf Freigabe.',
          action: actionPayload(action),
          repairDelegation: payload,
          executed: repair.created,
        })
      }

      if (repair.delegation.status === 'approved') {
        const executeResponse = await postInternal(
          `/api/delegations/${encodeURIComponent(repair.delegation.id)}/execute`,
          request,
        )
        const executeResult = await responseJson(executeResponse)

        if (!executeResponse.ok) {
          return NextResponse.json({
            ok: false,
            status: 'repair_start_failed',
            message: 'Repair-Delegation wurde gefunden, konnte aber nicht gestartet werden.',
            action: actionPayload(action),
            repairDelegation: payload,
            result: executeResult,
            executed: false,
          }, { status: 502 })
        }

        return NextResponse.json({
          ok: true,
          status: repair.created ? 'repair_created_and_started' : 'repair_started',
          message: repair.created
            ? 'Repair-Delegation wurde erstellt und direkt gestartet.'
            : 'Vorhandene Repair-Delegation wurde gestartet.',
          action: actionPayload(action),
          repairDelegation: payload,
          result: executeResult,
          executed: true,
        })
      }

      if (repair.delegation.status === 'completed') {
        const repairAction = getDeliveryActionForDelegation(repair.delegation)

        if (!repairAction) {
          return NextResponse.json({
            ok: true,
            status: 'repair_complete',
            message: 'Repair-Delegation ist abgeschlossen und hat aktuell keinen weiteren Delivery-Schritt.',
            action: actionPayload(action),
            repairDelegation: payload,
            executed: false,
          })
        }

        if (repairAction.type === 'repair_required' || repairAction.type === 'review_pr') {
          return NextResponse.json({
            ok: true,
            status: repairAction.type === 'repair_required' ? 'repair_needs_repair' : 'repair_pr_review',
            message: describeDeliveryAction(repairAction),
            action: actionPayload(action),
            repairDelegation: payload,
            repairAction: actionPayload(repairAction),
            executed: false,
          })
        }

        const repairStepResponse = await executeDeliveryActionStep(repairAction, request)
        if (!repairStepResponse) {
          return NextResponse.json({
            ok: true,
            status: 'repair_step_ready',
            message: describeDeliveryAction(repairAction),
            action: actionPayload(action),
            repairDelegation: payload,
            repairAction: actionPayload(repairAction),
            executed: false,
          })
        }

        const repairStepResult = await responseJson(repairStepResponse)
        if (!repairStepResponse.ok) {
          return NextResponse.json({
            ok: false,
            status: 'repair_step_failed',
            message: `Repair Delivery Cycle konnte ${repairAction.type} nicht ausfuehren.`,
            action: actionPayload(action),
            repairDelegation: payload,
            repairAction: actionPayload(repairAction),
            result: repairStepResult,
            executed: false,
          }, { status: 502 })
        }

        return NextResponse.json({
          ok: true,
          status: 'repair_step_executed',
          message: `${describeDeliveryAction(repairAction)} wurde fuer den Repair-Slice ausgefuehrt.`,
          action: actionPayload(action),
          repairDelegation: payload,
          repairAction: actionPayload(repairAction),
          result: repairStepResult,
          executed: true,
        })
      }

      return NextResponse.json({
        ok: true,
        status: repair.created ? 'repair_created' : 'repair_exists',
        message: repair.created
          ? 'Repair-Delegation wurde aus dem Delivery-Gate erstellt.'
          : 'Repair-Delegation existiert bereits; keine Duplikate erzeugt.',
        action: actionPayload(action),
        repairDelegation: payload,
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

  const response = await executeDeliveryActionStep(action, request)

  if (!response) {
    return NextResponse.json({
      ok: true,
      status: 'ready',
      message: describeDeliveryAction(action),
      action: actionPayload(action),
      executed: false,
    })
  }

  const result = await responseJson(response)

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
