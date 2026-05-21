import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { upsertAttentionItem } from '@/lib/attention/store'
import { createDelegationRepository, SINGLE_TENANT_USER_ID } from '@/lib/repositories/delegationRepository'

export const dynamic = 'force-dynamic'

interface EscalateBody {
  problem: string
  options?: string[]
  recommendation?: string
}

/**
 * POST /api/delegations/[id]/escalate
 *
 * Called by a running agent when it needs human input.
 * Creates an escalation AttentionItem that blocks further autonomous action.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)

  const delegation = await repo.findById(id)
  if (!delegation) {
    return NextResponse.json({ error: 'Delegation nicht gefunden' }, { status: 404 })
  }

  const body = await req.json() as EscalateBody
  if (!body.problem) {
    return NextResponse.json({ error: 'problem required' }, { status: 400 })
  }

  const label = delegation.title || delegation.contract.goal.slice(0, 60)

  upsertAttentionItem({
    id: `escalation:${id}:${randomUUID().slice(0, 8)}`,
    type: 'escalation',
    severity: 'warning',
    title: `Eskalation: ${label}`,
    body: body.problem,
    delegationId: id,
    actionUrl: `/delegations/${id}`,
    escalationContext: {
      problem: body.problem,
      options: body.options,
      recommendation: body.recommendation,
    },
    createdAt: new Date().toISOString(),
  })

  return NextResponse.json({ escalated: true })
}
