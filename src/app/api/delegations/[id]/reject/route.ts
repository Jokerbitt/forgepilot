export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { AgentLog } from '@/lib/models/delegation'
import {
  createDelegationRepository,
  SINGLE_TENANT_USER_ID,
} from '@/lib/repositories/delegationRepository'
import { logAuditEvent } from '@/lib/audit'

const RejectBodySchema = z.object({
  reason: z.string().max(500).optional(),
  actor:  z.string().max(100).default('user'),
})

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
      { error: `Delegation kann nicht abgelehnt werden - Status ist '${delegation.status}'.` },
      { status: 409 },
    )
  }

  const body = await parseBody(request)
  const now = new Date().toISOString()
  const note = body.reason ? ` — ${body.reason}` : ''

  const log: AgentLog = {
    timestamp: now,
    type: 'info',
    message: `Delegation abgelehnt durch ${body.actor}${note}.`,
  }

  const updated = await repo.update(id, {
    status: 'rejected',
    logs: [...(delegation.logs ?? []), log],
  })

  if (!updated) {
    return NextResponse.json({ error: 'Delegation nicht gefunden' }, { status: 404 })
  }

  logAuditEvent({
    action: 'delegation.rejected',
    entityId: delegation.id,
    entityType: 'delegation',
    entityTitle: delegation.title,
    actor: body.actor,
    metadata: { reason: body.reason },
  })

  return NextResponse.json(updated)
}

async function parseBody(request: Request): Promise<z.infer<typeof RejectBodySchema>> {
  try {
    const raw = await request.json() as unknown
    return RejectBodySchema.parse(raw)
  } catch {
    return RejectBodySchema.parse({})
  }
}
