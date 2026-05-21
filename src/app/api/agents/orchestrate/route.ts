export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { decomposeWithAI } from '@/lib/agents/ai-decomposer'
import { createRun, listRuns } from '@/lib/agents/orchestrated-run'
import { parseBody, isValidationError } from '@/lib/validation/api'
import { CreateOrchestratedRunSchema } from '@/lib/validation/schemas'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const delegationId = searchParams.get('delegationId') ?? undefined
  const runs = listRuns(delegationId)
  return NextResponse.json({ runs, count: runs.length })
}

export async function POST(req: NextRequest) {
  const body = await parseBody(req, CreateOrchestratedRunSchema)
  if (isValidationError(body)) return body

  const { delegationId, delegationTitle, goal, context } = body

  // AI decomposition with pattern-based fallback
  const tasks = await decomposeWithAI(goal, context)
  const run = createRun(delegationId, delegationTitle ?? goal, goal, tasks)

  return NextResponse.json({ run, taskCount: tasks.length }, { status: 201 })
}
