import { NextResponse } from 'next/server'
import { getRun, updateRun } from '@/lib/agent-runs/store'
import { buildRunSummary } from '@/lib/writeback/summary'
import { writeRunLessons } from '@/lib/writeback/lessons'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const run = getRun(params.id)
  if (!run) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(run)
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json() as Record<string, unknown>
  const run = updateRun(params.id, body)
  if (!run) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Auto-writeback lessons when a run reaches terminal status
  const newStatus = body.status as string | undefined
  if (newStatus === 'completed' || newStatus === 'failed') {
    writeRunLessons(run)
  }

  return NextResponse.json(run)
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const run = getRun(params.id)
  if (!run) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { markdown, lessonProposal } = buildRunSummary(run)
  return NextResponse.json({ run, summary: markdown, lessonProposal })
}
