export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createDelegationRepository, SINGLE_TENANT_USER_ID } from '@/lib/repositories/delegationRepository'
import { buildClonedDelegation } from '@/lib/delegations/clone'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)

  const source = await repo.findById(id)
  if (!source) {
    return NextResponse.json({ error: 'Delegation nicht gefunden' }, { status: 404 })
  }

  const cloned = buildClonedDelegation(source)
  const created = await repo.create(cloned)

  return NextResponse.json({ delegationId: created.id }, { status: 201 })
}
