export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getRun, updateRunStatus } from '@/lib/agents/orchestrated-run'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params
  const run = getRun(runId)
  if (!run) {
    return NextResponse.json({ error: 'Run not found' }, { status: 404 })
  }

  if (run.status === 'done' || run.status === 'aborted' || run.status === 'failed') {
    return NextResponse.json(
      { error: `Cannot abort a run with status "${run.status}"` },
      { status: 409 },
    )
  }

  updateRunStatus(runId, 'aborted')

  return NextResponse.json({ aborted: true, runId: runId })
}
