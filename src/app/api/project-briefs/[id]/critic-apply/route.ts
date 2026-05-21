export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createProjectBriefRepository } from '@/lib/repositories/projectBriefRepository'
import type { CriticReview } from '@/lib/brief-critic/types'

type RouteParams = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: RouteParams) {
  const { id } = await params
  try {
    const body = await request.json() as { suggestionId?: string }
    const repo = createProjectBriefRepository()
    const brief = await repo.findById(id)
    if (!brief) return NextResponse.json({ error: 'Brief not found' }, { status: 404 })

    const review = brief.criticReview as CriticReview | undefined
    if (!review) return NextResponse.json({ error: 'No critic review — run review first' }, { status: 422 })

    const suggestion = review.suggestions.find(s => s.id === body.suggestionId)
    if (!suggestion) return NextResponse.json({ error: 'Suggestion not found' }, { status: 404 })

    const updated = await repo.update(id, {
      ...suggestion.patch,
      status: 'accepted',
      criticReview: { ...review, appliedSuggestionId: suggestion.id },
    })
    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ error: 'Failed to apply suggestion' }, { status: 500 })
  }
}
