export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import {
  buildProjectBrief,
} from '@/lib/project-briefs'
import { parseBody, isValidationError } from '@/lib/validation/api'
import { ProjectBriefSchema } from '@/lib/validation/schemas'
import { createProjectBriefRepository } from '@/lib/repositories/projectBriefRepository'

export async function GET() {
  try {
    const repo = createProjectBriefRepository()
    const briefs = await repo.listAll()
    return NextResponse.json(briefs)
  } catch {
    return NextResponse.json({ error: 'Failed to read project briefs' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const result = await parseBody(request, ProjectBriefSchema)
  if (isValidationError(result)) return result

  try {
    const brief = buildProjectBrief(result)
    const repo = createProjectBriefRepository()
    const saved = await repo.create(brief)
    return NextResponse.json(saved, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create project brief' }, { status: 500 })
  }
}
