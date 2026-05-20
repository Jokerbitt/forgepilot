export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { preflight } from '@/lib/agents/scope-lock'

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    branch?: string
    filePatterns?: string[]
    agentId?: string
  }
  const { branch, filePatterns, agentId } = body
  if (!branch || !filePatterns?.length) {
    return NextResponse.json({ error: 'branch and filePatterns required' }, { status: 400 })
  }
  return NextResponse.json(preflight(branch, filePatterns, agentId))
}
