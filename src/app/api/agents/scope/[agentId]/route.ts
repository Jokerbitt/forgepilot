export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { releaseScope, isScopeLocked } from '@/lib/agents/scope-lock'

export async function DELETE(
  _req: Request,
  { params }: { params: { agentId: string } },
) {
  const released = releaseScope(params.agentId)
  if (!released) {
    return NextResponse.json({ error: 'No active scope for this agent' }, { status: 404 })
  }
  return NextResponse.json({ released: true, agentId: params.agentId })
}

export async function GET(
  _req: Request,
  { params }: { params: { agentId: string } },
) {
  const lock = isScopeLocked(params.agentId)
  return NextResponse.json({ locked: Boolean(lock), claim: lock })
}
