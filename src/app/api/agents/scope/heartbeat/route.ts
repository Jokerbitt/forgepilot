export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { heartbeatScope } from '@/lib/agents/scope-lock'
import { parseBody, isValidationError } from '@/lib/validation/api'
import { ScopeLockHeartbeatSchema } from '@/lib/validation/schemas'

export async function POST(req: NextRequest) {
  const body = await parseBody(req, ScopeLockHeartbeatSchema)
  if (isValidationError(body)) return body

  const { agentId, ttlMinutes } = body
  const renewed = heartbeatScope(agentId, ttlMinutes)
  return NextResponse.json({ renewed, agentId }, { status: renewed ? 200 : 404 })
}
