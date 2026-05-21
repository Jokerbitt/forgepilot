export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { findProjectBriefById, updateProjectBrief } from '@/lib/project-briefs'
import { saveSnapshot } from '@/lib/project-briefs/brief-versions'
import type { ProjectBrief } from '@/lib/models/project-brief'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params
  try {
    const brief = findProjectBriefById(id)
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
    const patch = await request.json() as Partial<Omit<ProjectBrief, 'id' | 'createdAt'>>
    const current = findProjectBriefById(id)
    if (!current) {
      return NextResponse.json({ error: 'Project brief not found' }, { status: 404 })
    }
    saveSnapshot(current, 'Automatisch vor Update')
    const updated = updateProjectBrief(id, patch)
    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ error: 'Failed to update project brief' }, { status: 500 })
  }
}
