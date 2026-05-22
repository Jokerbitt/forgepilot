export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getRun, reapStaleRuns, updateTaskStatus, updateRunStatus } from '@/lib/agents/orchestrated-run'
import type { TaskResult, RunStatus } from '@/lib/agents/orchestrated-run'
import type { AtomicTaskStatus } from '@/lib/agents/atomic-task'
import { parseBody, isValidationError } from '@/lib/validation/api'
import { OrchestratedRunPatchSchema } from '@/lib/validation/schemas'

export async function GET(_req: Request, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params
  reapStaleRuns()
  const run = getRun(runId)
  if (!run) return NextResponse.json({ error: 'Run not found' }, { status: 404 })
  return NextResponse.json(run)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params
  const body = await parseBody(req, OrchestratedRunPatchSchema)
  if (isValidationError(body)) return body

  if (body.runStatus) {
    updateRunStatus(runId, body.runStatus as RunStatus)
    return NextResponse.json({ ok: true })
  }

  if (!body.taskId || !body.status) {
    return NextResponse.json({ error: 'taskId and status required' }, { status: 400 })
  }

  const updated = updateTaskStatus(runId, body.taskId, body.status as AtomicTaskStatus, body.result as TaskResult | undefined)
  if (!updated) return NextResponse.json({ error: 'Run or task not found' }, { status: 404 })
  return NextResponse.json(updated)
}
