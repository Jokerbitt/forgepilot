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

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await request.json() as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const constraints = Array.isArray(body.constraints)
    ? (body.constraints as string[]).map(String)
    : typeof body.constraints === 'string'
      ? splitConstraintLines(body.constraints)
      : []

  const input: IdeaIntakeInput = {
    title:            String(body.title ?? ''),
    rawIdea:          String(body.rawIdea ?? body.raw_idea ?? body.idea ?? ''),
    problemStatement: String(body.problemStatement ?? body.problem_statement ?? body.problem ?? ''),
    targetAudience:   String(body.targetAudience ?? body.target_audience ?? body.audience ?? ''),
    desiredOutcome:   String(body.desiredOutcome ?? body.desired_outcome ?? body.outcome ?? ''),
    scope:            (body.scope as IdeaIntakeInput['scope']) ?? 'standard',
    researchMode:     (body.researchMode ?? body.research_mode) as IdeaIntakeInput['researchMode'] ?? 'standard',
    privacyMode:      (body.privacyMode ?? body.privacy_mode) as IdeaIntakeInput['privacyMode'] ?? 'local',
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
