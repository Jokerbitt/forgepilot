import { NextResponse } from 'next/server'
import { decomposeWithAI } from '@/lib/agents/ai-decomposer'
import { createRun, listRuns } from '@/lib/agents/orchestrated-run'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const delegationId = searchParams.get('delegationId') ?? undefined
  const runs = listRuns(delegationId)
  return NextResponse.json({ runs, count: runs.length })
}

export async function POST(req: Request) {
  const body = await req.json() as {
    delegationId: string
    delegationTitle: string
    goal: string
    context?: string
    useAI?: boolean
  }

  const { delegationId, delegationTitle, goal, context } = body
  if (!delegationId || !goal) {
    return NextResponse.json({ error: 'delegationId and goal are required' }, { status: 400 })
  }

  // AI decomposition with pattern-based fallback
  const tasks = await decomposeWithAI(goal, context)
  const run = createRun(delegationId, delegationTitle ?? goal, goal, tasks)

  return NextResponse.json({ run, taskCount: tasks.length }, { status: 201 })
}
