export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { claimScope, releaseScope, getActiveClaims } from '@/lib/agents/scope-lock'
import type { AgentType } from '@/lib/agents/agent-skills'
import { parseBody, isValidationError } from '@/lib/validation/api'
import { ScopeLockClaimSchema } from '@/lib/validation/schemas'

export async function GET() {
  const claims = getActiveClaims()
  return NextResponse.json({ claims, count: claims.length })
}

export async function POST(req: NextRequest) {
  const body = await parseBody(req, ScopeLockClaimSchema)
  if (isValidationError(body)) return body

  const { agentId, agentType, milestone, branch, filePatterns, ttlMinutes, pid, shareBranch } = body

  const result = claimScope(agentId, agentType as AgentType, milestone, branch, filePatterns, {
    ttlMinutes,
    pid,
    shareBranch,
  })
  return NextResponse.json(result, { status: result.success ? 200 : 409 })
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url)
  const agentId = searchParams.get('agentId')
  if (!agentId) {
    return NextResponse.json({ error: 'agentId query param required' }, { status: 400 })
  }
  const released = releaseScope(agentId)
  return NextResponse.json({ released, agentId })
}
