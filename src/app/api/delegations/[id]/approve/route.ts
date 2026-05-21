export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import type { AgentLog } from '@/lib/models/delegation'
import { getAutonomousConfig, riskClassFitsThreshold } from '@/lib/config/autonomous-config'
import {
  createDelegationRepository,
  SINGLE_TENANT_USER_ID,
} from '@/lib/repositories/delegationRepository'
import { logAuditEvent } from '@/lib/audit'

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

  if (delegation.contract.riskClass === 'C') {
    return NextResponse.json(
      { error: 'RiskClass C braucht manuelle Freigabe in der App.' },
      { status: 403 },
    )
  }

  // Autonomous mode: determine source based on config
  const autonomousConfig = getAutonomousConfig()
  const isAutoApprove =
    autonomousConfig.enabled &&
    autonomousConfig.autoApproveDelegations &&
    riskClassFitsThreshold(delegation.contract.riskClass, autonomousConfig.riskThreshold)

  const body = await safeReadBody(request)
  const now = new Date().toISOString()
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
