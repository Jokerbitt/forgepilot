export const dynamic = 'force-dynamic'
/**
 * POST /api/delegations/[id]/reject
 *
 * Rejects a pending delegation with an optional reason.
 * Only 'pending' delegations can be rejected; running/completed/cancelled are immutable.
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { AgentLog } from '@/lib/models/delegation'
import {
  createDelegationRepository,
  SINGLE_TENANT_USER_ID,
} from '@/lib/repositories/delegationRepository'
import { parseBody } from '@/lib/validation/api'
import { logAuditEvent } from '@/lib/audit'

const RejectSchema = z.object({
  reason: z.string().max(500).optional(),
  actor:  z.string().max(100).default('user'),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const parsed = await parseBody(request, RejectSchema)
  if (parsed instanceof NextResponse) return parsed

  const { reason, actor } = parsed
  const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
  const delegation = await repo.findById(id)

  if (!delegation) {
    return NextResponse.json({ error: 'Delegation not found' }, { status: 404 })
  }

  if (delegation.status !== 'pending') {
    return NextResponse.json(
      { error: `Cannot reject delegation with status '${delegation.status}'` },
      { status: 409 },
    )
  }

  const reasonText = reason ? ` Reason: ${reason}` : ''
  const log: AgentLog = {
    timestamp: new Date().toISOString(),
    type: 'error',
    message: `Delegation rejected by ${actor}.${reasonText}`,
  }

  const updated = await repo.update(id, {
    status: 'rejected',
    logs: [...(delegation.logs ?? []), log],
  })

  if (!updated) {
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }

  logAuditEvent({
    action: 'delegation.rejected',
    entityId: delegation.id,
    entityType: 'delegation',
    entityTitle: delegation.title,
    actor,
    metadata: { reason },
  })

  return NextResponse.json(updated)
}
