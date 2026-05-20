export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { retryTask, canRetry } from '@/lib/agents/orchestrated-run'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ runId: string; taskId: string }> },
) {
  const { runId, taskId } = await params

  if (!canRetry(runId, taskId)) {
    return NextResponse.json(
      { error: 'Task cannot be retried (not failed or max retries reached)' },
      { status: 400 },
    )
  }

  const run = retryTask(runId, taskId)
  if (!run) return NextResponse.json({ error: 'Run or task not found' }, { status: 404 })

  return NextResponse.json({ ok: true, run })
}
