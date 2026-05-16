import { NextResponse } from 'next/server'
import {
  buildResearchBriefFromProjectBrief,
  buildResearchRunPoc,
  findProjectBriefById,
} from '@/lib/project-briefs'

interface RouteParams {
  params: { id: string }
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const brief = findProjectBriefById(params.id)
    if (!brief) {
      return NextResponse.json({ error: 'Project brief not found' }, { status: 404 })
    }

    const researchBrief = buildResearchBriefFromProjectBrief(brief)
    return NextResponse.json(buildResearchRunPoc(brief, researchBrief))
  } catch {
    return NextResponse.json({ error: 'Failed to build research run preview' }, { status: 500 })
  }
}
