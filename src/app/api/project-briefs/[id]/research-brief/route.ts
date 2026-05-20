export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { buildResearchBriefFromProjectBrief, findProjectBriefById } from '@/lib/project-briefs'

interface RouteParams {
  params: { id: string }
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const brief = findProjectBriefById(params.id)
    if (!brief) {
      return NextResponse.json({ error: 'Project brief not found' }, { status: 404 })
    }

    return NextResponse.json(buildResearchBriefFromProjectBrief(brief))
  } catch {
    return NextResponse.json({ error: 'Failed to build research brief' }, { status: 500 })
  }
}
