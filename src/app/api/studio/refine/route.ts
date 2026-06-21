export const dynamic = 'force-dynamic'

/**
 * POST /api/studio/refine
 * Body: { idea: string }
 * Returns: IdeaRefinement { goal, appName, appType, directions[] }
 *
 * Brainstorm step of the guided Idea Studio — turns a rough idea into a clear,
 * buildable goal with alternative directions. Always returns something usable.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { refineIdea } from '@/lib/studio/brainstorm'

export async function POST(req: NextRequest) {
  const authError = await requireAuth()
  if (authError) return authError

  let body: { idea?: string }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Ungültiger Body' }, { status: 400 })
  }
  const idea = body.idea?.trim()
  if (!idea) return NextResponse.json({ error: 'idea ist erforderlich' }, { status: 400 })

  const refinement = await refineIdea({ idea })
  return NextResponse.json(refinement)
}
