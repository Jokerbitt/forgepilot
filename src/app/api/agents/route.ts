export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getAgents, upsertAgent } from '@/lib/agents/registry'
import type { AgentRole } from '@/lib/models/agent-profile'
import type { AgentProfile } from '@/lib/models/agent-profile'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const role = searchParams.get('role') as AgentRole | null
  return NextResponse.json(getAgents(role ?? undefined))
}

export async function POST(req: Request) {
  const body = await req.json() as Partial<AgentProfile>
  if (!body.id || !body.role || !body.displayName) {
    return NextResponse.json({ error: 'id, role, displayName required' }, { status: 400 })
  }
  const now = new Date().toISOString()
  const profile: AgentProfile = {
    availability: 'available',
    autonomyLevel: 'supervised-write',
    strengths: [],
    limits: [],
    preferredWorkloads: [],
    allowedToolIds: [],
    skillRefs: [],
    costClass: 'metered-low',
    updatedAt: now,
    ...body,
    id: body.id,
    role: body.role,
    displayName: body.displayName,
  }
  return NextResponse.json(upsertAgent(profile), { status: 201 })
}
