export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getRun, updateTaskStatus, updateRunStatus } from '@/lib/agents/orchestrated-run'
import type { TaskResult, RunStatus } from '@/lib/agents/orchestrated-run'
import type { AtomicTaskStatus } from '@/lib/agents/atomic-task'

export async function GET(_req: Request, { params }: { params: { runId: string } }) {
  const run = getRun(params.runId)
  if (!run) return NextResponse.json({ error: 'Run not found' }, { status: 404 })
  return NextResponse.json(run)
}

export async function PATCH(req: Request, { params }: { params: { runId: string } }) {
  const body = await req.json() as {
    taskId?: string
    status?: AtomicTaskStatus
    result?: TaskResult
    runStatus?: string
  }

  if (body.runStatus) {
    updateRunStatus(params.runId, body.runStatus as RunStatus)
    return NextResponse.json({ ok: true })
  }

  if (!body.taskId || !body.status) {
    return NextResponse.json({ error: 'taskId and status required' }, { status: 400 })
  }

  const updated = updateTaskStatus(params.runId, body.taskId, body.status, body.result)
  if (!updated) return NextResponse.json({ error: 'Run or task not found' }, { status: 404 })
  return NextResponse.json(updated)
}
