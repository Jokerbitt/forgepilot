import { type NextRequest, NextResponse } from 'next/server'
import { syncAttentionFromDelegations } from '@/lib/attention/engine'
import { getOpenAttentionItems, upsertAttentionItem } from '@/lib/attention/store'
import { parseBody } from '@/lib/validation/api'
import { AttentionItemCreateSchema } from '@/lib/validation/schemas'
import { randomUUID } from 'crypto'
import { createDelegationRepository, SINGLE_TENANT_USER_ID } from '@/lib/repositories/delegationRepository'

export const dynamic = 'force-dynamic'

/** GET /api/attention — sync from delegation state and return open items */
export async function GET() {
  const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
  const delegations = await repo.listByStatus()
  syncAttentionFromDelegations(delegations)
  const items = getOpenAttentionItems()
  return NextResponse.json(items)
}

/** POST /api/attention — create a custom attention item (e.g. from agent escalation) */
export async function POST(req: NextRequest) {
  const result = await parseBody(req, AttentionItemCreateSchema)
  if (result instanceof NextResponse) return result

  const item = {
    id: result.id ?? randomUUID(),
    type: result.type,
    severity: result.severity,
    title: result.title,
    body: result.body ?? '',
    delegationId: result.delegationId,
    actionUrl: result.actionUrl,
    escalationContext: result.escalationContext,
    createdAt: new Date().toISOString(),
  }
  upsertAttentionItem(item)
  return NextResponse.json(item, { status: 201 })
}
