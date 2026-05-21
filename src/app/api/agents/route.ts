export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getAgents, upsertAgent } from '@/lib/agents/registry'
import type { AgentRole } from '@/lib/models/agent-profile'
import type { AgentProfile } from '@/lib/models/agent-profile'
import { parseBody, isValidationError } from '@/lib/validation/api'
import { AgentProfileSchema } from '@/lib/validation/schemas'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const role = searchParams.get('role') as AgentRole | null
  return NextResponse.json(getAgents(role ?? undefined))
}

export async function POST(req: NextRequest) {
  const body = await parseBody(req, AgentProfileSchema)
  if (isValidationError(body)) return body
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
    role: body.role as AgentRole,
    displayName: body.displayName,
  }
  return NextResponse.json(upsertAgent(profile), { status: 201 })
}
