import { NextRequest, NextResponse } from 'next/server'
import {
  listEvalCases,
  listEvalResults,
  upsertEvalCase,
  deleteEvalCase,
  listEvalAlerts,
  acknowledgeAlert,
  type EvalCase,
} from '@/lib/eval/harness'
import crypto from 'crypto'

// GET /api/eval — list cases + recent results + alerts
export function GET(request: NextRequest) {
  const url     = new URL(request.url)
  const type    = url.searchParams.get('type') ?? 'cases'
  const caseId  = url.searchParams.get('caseId') ?? undefined

  if (type === 'results') return NextResponse.json(listEvalResults(caseId))
  if (type === 'alerts')  return NextResponse.json(listEvalAlerts())
  return NextResponse.json(listEvalCases())
}

// POST /api/eval — create/update case OR acknowledge alert
export async function POST(request: NextRequest) {
  const body = await request.json() as Partial<EvalCase> & { action?: string; alertId?: string }

  if (body.action === 'acknowledge' && body.alertId) {
    acknowledgeAlert(body.alertId)
    return NextResponse.json({ ok: true })
  }

  const c = upsertEvalCase({
    id:                 body.id ?? `case-${crypto.randomUUID()}`,
    title:              body.title ?? 'Untitled',
    prompt:             body.prompt ?? '',
    skillCategory:      body.skillCategory,
    acceptanceCriteria: body.acceptanceCriteria ?? [],
    goldenOutput:       body.goldenOutput,
    tags:               body.tags ?? [],
    active:             body.active ?? true,
  })
  return NextResponse.json(c)
}

// DELETE /api/eval?caseId=xxx
export function DELETE(request: NextRequest) {
  const id = new URL(request.url).searchParams.get('caseId')
  if (!id) return NextResponse.json({ error: 'caseId required' }, { status: 400 })
  deleteEvalCase(id)
  return NextResponse.json({ ok: true })
}
