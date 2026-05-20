export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { heartbeatScope } from '@/lib/agents/scope-lock'

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { agentId?: string; ttlMinutes?: number }
  const { agentId, ttlMinutes } = body
  if (!agentId) {
    return NextResponse.json({ error: 'agentId required' }, { status: 400 })
  }
  const renewed = heartbeatScope(agentId, ttlMinutes)
  return NextResponse.json({ renewed, agentId }, { status: renewed ? 200 : 404 })
}
