export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { claimScope, releaseScope, getActiveClaims } from '@/lib/agents/scope-lock'
import type { AgentType } from '@/lib/agents/agent-skills'

export async function GET() {
  const claims = getActiveClaims()
  return NextResponse.json({ claims, count: claims.length })
}

export async function POST(req: Request) {
  const body = await req.json() as {
    agentId?: string
    agentType?: AgentType
    milestone?: string
    branch?: string
    filePatterns?: string[]
    ttlMinutes?: number
    pid?: number
    shareBranch?: boolean
  }

  const { agentId, agentType, milestone, branch, filePatterns, ttlMinutes, pid, shareBranch } = body

  if (!agentId || !agentType || !milestone || !branch || !filePatterns?.length) {
    return NextResponse.json(
      { error: 'agentId, agentType, milestone, branch, filePatterns required' },
      { status: 400 },
    )
  }

  const result = claimScope(agentId, agentType, milestone, branch, filePatterns, {
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
