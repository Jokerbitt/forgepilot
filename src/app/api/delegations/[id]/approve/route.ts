export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import type { AgentLog } from '@/lib/models/delegation'
import { getAutonomousConfig, riskClassFitsThreshold } from '@/lib/config/autonomous-config'
import {
  createDelegationRepository,
  SINGLE_TENANT_USER_ID,
} from '@/lib/repositories/delegationRepository'
import { logAuditEvent } from '@/lib/audit'
import { validateRiskCApproval } from '@/lib/delegations/risk-c-approval'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
  const delegation = await repo.findById(id)

  if (!delegation) {
    return NextResponse.json({ error: 'Delegation nicht gefunden' }, { status: 404 })
  }

  if (delegation.status !== 'pending') {
    return NextResponse.json(
      { error: `Delegation kann nicht genehmigt werden - Status ist '${delegation.status}'.` },
      { status: 409 },
    )
  }

  const body = await safeReadBody(request)
  const now = new Date().toISOString()

  // ADR-004 (E1-A/E3-A): Risk-C has a guarded human-approval path. Only an
  // allowlisted human actor (FORGEPILOT_RISK_C_APPROVERS) with a typed reason may
  // lift the gate; everything else stays blocked. The central execution
  // choke-point (getExecutionStartBlocker / ADR-003 D2) independently re-checks
  // for a human approvedBy before the run can actually start.
  const isRiskC = delegation.contract.riskClass === 'C'
  if (isRiskC) {
    const actor = typeof body.source === 'string' ? body.source.trim() : ''
    const reason = typeof body.note === 'string' ? body.note.trim() : ''
    const check = validateRiskCApproval(actor, reason)
    if (!check.ok) {
      return NextResponse.json({ error: check.error }, { status: check.status })
    }
  }

  // Autonomous mode: determine source based on config. Never applies to Risk-C —
  // a Risk-C approval is always an explicit human act (validated above).
  const autonomousConfig = getAutonomousConfig()
  const isAutoApprove =
    !isRiskC &&
    autonomousConfig.enabled &&
    autonomousConfig.autoApproveDelegations &&
    riskClassFitsThreshold(delegation.contract.riskClass, autonomousConfig.riskThreshold)

  const source = isAutoApprove
    ? 'autonomous-mode'
    : typeof body.source === 'string' && body.source.trim()
      ? body.source.trim()
      : 'api'
  const note = typeof body.note === 'string' && body.note.trim()
    ? ` (${body.note.trim()})`
    : ''

  const log: AgentLog = {
    timestamp: now,
    type: 'success',
    message: `Delegation genehmigt durch ${source}${note}.`,
  }

  const updated = await repo.update(id, {
    status: 'approved',
    approvalId: delegation.approvalId ?? `approval-${Date.now()}`,
    // ADR-003 P2: record WHO lifted the approval gate, not just that it was lifted.
    approvedBy: {
      actor: source,
      approvedAt: now,
      ...(typeof body.note === 'string' && body.note.trim() ? { reason: body.note.trim() } : {}),
    },
    contract: {
      ...delegation.contract,
      requiresApproval: false,
    },
    logs: [...(delegation.logs ?? []), log],
  })

  if (!updated) {
    return NextResponse.json({ error: 'Delegation nicht gefunden' }, { status: 404 })
  }

  logAuditEvent({
    action: 'delegation.approved',
    entityId: delegation.id,
    entityType: 'delegation',
    entityTitle: delegation.title,
    actor: source,
    metadata: { note: body.note },
  })

  return NextResponse.json(updated)
}

async function safeReadBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const parsed = await request.json() as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {}
  } catch {
    return {}
  }
}
