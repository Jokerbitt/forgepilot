export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import type { Delegation } from '@/lib/models/delegation'
import {
  createDelegationRepository,
  SINGLE_TENANT_USER_ID,
} from '@/lib/repositories/delegationRepository'

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
  const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
  const body = await req.json() as Partial<Pick<Delegation, 'status' | 'agentRunId'>>
  const patch: Partial<Delegation> = {}
  if (body.status !== undefined) patch.status = body.status
  if (body.agentRunId !== undefined) patch.agentRunId = body.agentRunId
  const updated = await repo.update(id, patch)
  if (!updated) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  return NextResponse.json(updated)
}
