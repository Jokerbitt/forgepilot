export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import {
  buildProjectBrief,
  saveProjectBrief,
  validateIdeaIntakeInput,
  hasIdeaIntakeErrors,
  splitConstraintLines,
} from '@/lib/project-briefs'
import type { IdeaIntakeInput } from '@/lib/models/project-brief'
import { verifyWebhookSignature } from '@/lib/webhooks/hmac'

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const signature =
    request.headers.get('x-forgepilot-signature') ??
    request.headers.get('x-hub-signature-256') // also support GitHub-style header

  const secret = process.env.INTAKE_WEBHOOK_SECRET
  if (!verifyWebhookSignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let body: unknown
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const typedBody = body as Record<string, unknown>

  const constraints = Array.isArray(typedBody.constraints)
    ? (typedBody.constraints as string[]).map(String)
    : typeof typedBody.constraints === 'string'
      ? splitConstraintLines(typedBody.constraints)
      : []

  const input: IdeaIntakeInput = {
    title:            String(typedBody.title ?? ''),
    rawIdea:          String(typedBody.rawIdea ?? typedBody.raw_idea ?? typedBody.idea ?? ''),
    problemStatement: String(typedBody.problemStatement ?? typedBody.problem_statement ?? typedBody.problem ?? ''),
    targetAudience:   String(typedBody.targetAudience ?? typedBody.target_audience ?? typedBody.audience ?? ''),
    desiredOutcome:   String(typedBody.desiredOutcome ?? typedBody.desired_outcome ?? typedBody.outcome ?? ''),
    scope:            (typedBody.scope as IdeaIntakeInput['scope']) ?? 'standard',
    researchMode:     (typedBody.researchMode ?? typedBody.research_mode) as IdeaIntakeInput['researchMode'] ?? 'standard',
    privacyMode:      (typedBody.privacyMode ?? typedBody.privacy_mode) as IdeaIntakeInput['privacyMode'] ?? 'local',
    constraints,
  }

  const errors = validateIdeaIntakeInput(input)
  if (hasIdeaIntakeErrors(errors)) {
    return NextResponse.json({ error: 'Validation failed', details: errors }, { status: 422 })
  }

  const brief = buildProjectBrief(input)
  saveProjectBrief(brief)

  return NextResponse.json(brief, { status: 201 })
}
