import { NextRequest, NextResponse } from 'next/server'
import {
  buildProjectBrief,
  readProjectBriefs,
  saveProjectBrief,
} from '@/lib/project-briefs'
import { parseBody, isValidationError } from '@/lib/validation/api'
import { ProjectBriefSchema } from '@/lib/validation/schemas'

export async function GET() {
  try {
    return NextResponse.json(readProjectBriefs())
  } catch {
    return NextResponse.json({ error: 'Failed to read project briefs' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const result = await parseBody(request, ProjectBriefSchema)
  if (isValidationError(result)) return result

  try {
    const brief = buildProjectBrief(result)
    const saved = saveProjectBrief(brief)
    return NextResponse.json(saved, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create project brief' }, { status: 500 })
  }
}
