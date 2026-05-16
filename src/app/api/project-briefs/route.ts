import { NextResponse } from 'next/server'
import {
  buildProjectBrief,
  hasIdeaIntakeErrors,
  readProjectBriefs,
  saveProjectBrief,
  validateIdeaIntakeInput,
} from '@/lib/project-briefs'
import type { IdeaIntakeInput } from '@/lib/models/project-brief'

export async function GET() {
  try {
    return NextResponse.json(readProjectBriefs())
  } catch {
    return NextResponse.json({ error: 'Failed to read project briefs' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const input = await request.json() as IdeaIntakeInput
    const errors = validateIdeaIntakeInput(input)

    if (hasIdeaIntakeErrors(errors)) {
      return NextResponse.json({ errors }, { status: 400 })
    }

    const brief = buildProjectBrief(input)
    const saved = saveProjectBrief(brief)
    return NextResponse.json(saved, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create project brief' }, { status: 500 })
  }
}
