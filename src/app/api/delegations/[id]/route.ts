export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import type { Delegation } from '@/lib/models/delegation'
import {
  createDelegationRepository,
  SINGLE_TENANT_USER_ID,
} from '@/lib/repositories/delegationRepository'
import { parseBody, isValidationError } from '@/lib/validation/api'
import { PatchDelegationSchema } from '@/lib/validation/schemas'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
  const delegation = await repo.findById(id)
  if (!delegation) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  return NextResponse.json(delegation)
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const result = await parseBody(req, PatchDelegationSchema)
  if (isValidationError(result)) return result

  const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
  const patch: Partial<Delegation> = {}
  if (result.status !== undefined) patch.status = result.status
  if (result.agentRunId !== undefined) patch.agentRunId = result.agentRunId
  if ('note' in result) patch.note = result.note ?? undefined
  if (result.tags !== undefined) patch.tags = result.tags
  if (result.priority !== undefined) patch.priority = result.priority
  const updated = await repo.update(id, patch)
  if (!updated) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  return NextResponse.json(updated)
}
