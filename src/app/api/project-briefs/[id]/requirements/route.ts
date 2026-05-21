export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { findProjectBriefById, updateProjectBrief } from '@/lib/project-briefs'
import type { Requirement, RequirementType, RequirementPriority } from '@/lib/models/project-brief'
import { parseBody, isValidationError } from '@/lib/validation/api'
import { RequirementAddSchema } from '@/lib/validation/schemas'

interface RouteParams {
  params: Promise<{ id: string }>
}

// PATCH /api/project-briefs/[id]/requirements
// Body: { requirementId, status } | { requirements: Requirement[] }
export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params
  try {
    const brief = findProjectBriefById(id)
    if (!brief) {
      return NextResponse.json({ error: 'Project brief not found' }, { status: 404 })
    }

    const body = await request.json() as
      | { requirementId: string; status: 'accepted' | 'rejected' | 'proposed' }
      | { requirements: Requirement[] }

    let updatedRequirements: Requirement[]

    if ('requirements' in body) {
      // Bulk replace
      updatedRequirements = body.requirements
    } else {
      // Single status update
      const { requirementId, status } = body
      updatedRequirements = brief.requirements.map(r =>
        r.id === requirementId ? { ...r, status } : r
      )
    }

    const updated = updateProjectBrief(id, { requirements: updatedRequirements })
    if (!updated) {
      return NextResponse.json({ error: 'Failed to update requirements' }, { status: 500 })
    }
    return NextResponse.json(updated.requirements)
  } catch {
    return NextResponse.json({ error: 'Failed to update requirements' }, { status: 500 })
  }
}

// POST /api/project-briefs/[id]/requirements
// Body: { title, description, type, priority }
export async function POST(request: Request, { params }: RouteParams) {
  const { id } = await params
  try {
    const brief = findProjectBriefById(id)
    if (!brief) {
      return NextResponse.json({ error: 'Project brief not found' }, { status: 404 })
    }

    const body = await parseBody(request, RequirementAddSchema)
    if (isValidationError(body)) return body

    const newReq: Requirement = {
      id: `${id}-req-${Date.now()}`,
      briefId: id,
      type: (body.type ?? 'functional') as RequirementType,
      title: body.title.trim(),
      description: body.description.trim(),
      priority: (body.priority ?? 'should') as RequirementPriority,
      source: 'user_input',
      findingIds: [],
      status: 'accepted', // manually added = immediately accepted
    }

    const updated = updateProjectBrief(id, {
      requirements: [...brief.requirements, newReq],
    })

    if (!updated) {
      return NextResponse.json({ error: 'Failed to save requirement' }, { status: 500 })
    }
    return NextResponse.json(newReq, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create requirement' }, { status: 500 })
  }
}
