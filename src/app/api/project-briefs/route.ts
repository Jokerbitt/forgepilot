import { NextRequest, NextResponse } from 'next/server'
import {
  buildProjectBrief,
  readProjectBriefs,
  saveProjectBrief,
} from '@/lib/project-briefs'
import { z } from 'zod'
import { parseBody, isValidationError } from '@/lib/validation/api'

// Zod schema aligned with IdeaIntakeInput — replaces validateIdeaIntakeInput()
const IdeaIntakeSchema = z.object({
  title:            z.string().min(3, 'Titel mindestens 3 Zeichen').max(200),
  rawIdea:          z.string().min(10, 'Idee mindestens 10 Zeichen'),
  problemStatement: z.string().min(10, 'Problem-Statement fehlt'),
  targetAudience:   z.string().min(3, 'Zielgruppe fehlt'),
  desiredOutcome:   z.string().min(5, 'Gewünschtes Ergebnis fehlt'),
  constraints:      z.array(z.string()).default([]),
  scope:            z.enum(['minimal', 'standard', 'full']).default('standard'),
  researchMode:     z.enum(['quick', 'standard', 'deep']).default('standard'),
  privacyMode:      z.enum(['local', 'hybrid', 'cloud']).default('local'),
})

export async function GET() {
  try {
    return NextResponse.json(readProjectBriefs())
  } catch {
    return NextResponse.json({ error: 'Failed to read project briefs' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const input = await parseBody(request, IdeaIntakeSchema)
    if (isValidationError(input)) return input

    const brief = buildProjectBrief(input)
    const saved = saveProjectBrief(brief)
    return NextResponse.json(saved, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create project brief' }, { status: 500 })
  }
}
