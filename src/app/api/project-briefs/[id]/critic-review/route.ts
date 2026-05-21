export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createProjectBriefRepository } from '@/lib/repositories/projectBriefRepository'
import { reviewBrief } from '@/lib/brief-critic'

type RouteParams = { params: Promise<{ id: string }> }

export async function POST(_request: Request, { params }: RouteParams) {
  const { id } = await params
  try {
    const repo = createProjectBriefRepository()
    const brief = await repo.findById(id)
    if (!brief) return NextResponse.json({ error: 'Brief not found' }, { status: 404 })
    const review = await reviewBrief(brief)
    const updated = await repo.update(id, { criticReview: review })
    return NextResponse.json({ review, brief: updated })
  } catch {
    return NextResponse.json({ error: 'Critic review failed' }, { status: 500 })
  }
}
