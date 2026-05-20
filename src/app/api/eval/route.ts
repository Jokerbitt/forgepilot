export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import {
  listEvalCases,
  listEvalResults,
  upsertEvalCase,
  deleteEvalCase,
  listEvalAlerts,
  acknowledgeAlert,
} from '@/lib/eval/harness'
import crypto from 'crypto'
import { parseBody, isValidationError } from '@/lib/validation/api'
import { EvalCaseSchema } from '@/lib/validation/schemas'
import { z } from 'zod'

const EvalPostSchema = z.union([
  z.object({ action: z.literal('acknowledge'), alertId: z.string().min(1) }),
  EvalCaseSchema,
])

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
  const body = await parseBody(request, EvalPostSchema)
  if (isValidationError(body)) return body

  if ('action' in body && body.action === 'acknowledge') {
    acknowledgeAlert(body.alertId)
    return NextResponse.json({ ok: true })
  }

  const c = upsertEvalCase({
    id:                 ('id' in body ? body.id : undefined) ?? `case-${crypto.randomUUID()}`,
    title:              'title' in body ? body.title : 'Untitled',
    prompt:             'prompt' in body ? body.prompt : '',
    skillCategory:      'skillCategory' in body ? body.skillCategory : undefined,
    acceptanceCriteria: 'acceptanceCriteria' in body ? body.acceptanceCriteria : [],
    goldenOutput:       'goldenOutput' in body ? body.goldenOutput : undefined,
    tags:               'tags' in body ? body.tags : [],
    active:             'active' in body ? body.active : true,
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
