export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { findProjectBriefById } from '@/lib/project-briefs'
import { saveSnapshot } from '@/lib/project-briefs/brief-versions'
import { createProjectBriefRepository } from '@/lib/repositories/projectBriefRepository'
import { parseBody, isValidationError } from '@/lib/validation/api'
import { ProjectBriefPatchSchema } from '@/lib/validation/schemas'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params
  try {
    const repo = createProjectBriefRepository()
    const brief = await repo.findById(id)
    if (!brief) {
      return NextResponse.json({ error: 'Project brief not found' }, { status: 404 })
    }
    return NextResponse.json(brief)
  } catch {
    return NextResponse.json({ error: 'Failed to read project brief' }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params
  try {
    const patch = await parseBody(request, ProjectBriefPatchSchema)
    if (isValidationError(patch)) return patch

    const current = findProjectBriefById(id)
    if (!current) {
      return NextResponse.json({ error: 'Project brief not found' }, { status: 404 })
    }
    saveSnapshot(current, 'Automatisch vor Update')
    const repo = createProjectBriefRepository()
    const updated = await repo.update(id, patch)

    // M217: Fire-and-forget — create Linear ticket when brief is accepted
    if (patch.status === 'accepted' && updated) {
      import('@/lib/linear/create-ticket').then(({ createLinearTicketForBrief }) =>
        createLinearTicketForBrief({
          title: updated.title,
          description: [
            `Problem: ${updated.problemStatement}`,
            `Zielgruppe: ${updated.targetAudience}`,
            `Outcome: ${updated.desiredOutcome}`,
          ].join('\n'),
          briefId: updated.id,
        }),
      ).catch(() => { /* non-critical */ })
    }

    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ error: 'Failed to update project brief' }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id } = await params
  try {
    const repo = createProjectBriefRepository()
    const deleted = await repo.delete(id)
    if (!deleted) {
      return NextResponse.json({ error: 'Project brief not found' }, { status: 404 })
    }
    return new NextResponse(null, { status: 204 })
  } catch {
    return NextResponse.json({ error: 'Failed to delete project brief' }, { status: 500 })
  }
}
