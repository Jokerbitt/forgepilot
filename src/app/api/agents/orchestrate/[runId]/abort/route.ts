import { NextResponse } from 'next/server'
import { getRun, updateRunStatus } from '@/lib/agents/orchestrated-run'

export async function POST(
  _req: Request,
  { params }: { params: { runId: string } },
) {
  const run = getRun(params.runId)
  if (!run) {
    return NextResponse.json({ error: 'Run not found' }, { status: 404 })
  }

  if (run.status === 'done' || run.status === 'aborted' || run.status === 'failed') {
    return NextResponse.json(
      { error: `Cannot abort a run with status "${run.status}"` },
      { status: 409 },
    )
  }

  updateRunStatus(params.runId, 'aborted')

  return NextResponse.json({ aborted: true, runId: params.runId })
}
