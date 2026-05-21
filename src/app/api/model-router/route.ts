export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { routeTask } from '@/lib/model-router/router'
import { saveDecision, getDecisions } from '@/lib/model-router/store'
import type { RouteTaskInput } from '@/lib/model-router/types'
import { parseBody, isValidationError } from '@/lib/validation/api'
import { ModelRouterTaskSchema } from '@/lib/validation/schemas'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const taskId = searchParams.get('taskId') ?? undefined
  return NextResponse.json(getDecisions(taskId))
}

export async function POST(req: NextRequest) {
  const body = await parseBody(req, ModelRouterTaskSchema)
  if (isValidationError(body)) return body

  const decision = routeTask(body as RouteTaskInput)
  saveDecision(decision)
  return NextResponse.json(decision, { status: 201 })
}
