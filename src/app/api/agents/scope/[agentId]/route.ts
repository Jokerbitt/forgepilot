export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { releaseScope, isScopeLocked } from '@/lib/agents/scope-lock'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const { agentId } = await params
  const released = releaseScope(agentId)
  if (!released) {
    return NextResponse.json({ error: 'No active scope for this agent' }, { status: 404 })
  }
  return NextResponse.json({ released: true, agentId: agentId })
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const { agentId } = await params
  const lock = isScopeLocked(agentId)
  return NextResponse.json({ locked: Boolean(lock), claim: lock })
}
