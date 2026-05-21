export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import {
  buildProjectBrief,
} from '@/lib/project-briefs'
import { parseBody, isValidationError } from '@/lib/validation/api'
import { ProjectBriefSchema } from '@/lib/validation/schemas'
import { createProjectBriefRepository } from '@/lib/repositories/projectBriefRepository'
import { logAuditEvent } from '@/lib/audit'

export async function GET(request: NextRequest) {
  try {
    const status = new URL(request.url).searchParams.get('status')
    const repo = createProjectBriefRepository()
    if (status) {
      const briefs = await repo.listByStatus(status as Parameters<typeof repo.listByStatus>[0])
      return NextResponse.json(briefs)
    }
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
    logAuditEvent({
      action: 'brief.created',
      entityId: saved.id,
      entityType: 'brief',
      entityTitle: saved.title,
      actor: 'user',
    })
    return NextResponse.json(saved, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create project brief' }, { status: 500 })
  }
}
