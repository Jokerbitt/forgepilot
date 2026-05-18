import { NextResponse } from 'next/server'
import { routeTask } from '@/lib/model-router/router'
import { saveDecision, getDecisions } from '@/lib/model-router/store'
import type { RouteTaskInput } from '@/lib/model-router/types'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const taskId = searchParams.get('taskId') ?? undefined
  return NextResponse.json(getDecisions(taskId))
}

export async function POST(req: Request) {
  const body = await req.json() as Partial<RouteTaskInput>
  if (!body.taskId || !body.workload || !body.privacyMode) {
    return NextResponse.json(
      { error: 'taskId, workload, privacyMode required' },
      { status: 400 },
    )
  }
  const decision = routeTask(body as RouteTaskInput)
  saveDecision(decision)
  return NextResponse.json(decision, { status: 201 })
}
