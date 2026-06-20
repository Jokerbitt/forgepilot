export const dynamic = 'force-dynamic'

/**
 * POST /api/studio/concept
 * Body: { goal, context?, feedback?, previousOverview? }
 * Returns: Concept { overview, appType, recommendations[], considerations[] }
 *
 * Generates or REFINES the blueprint. Pass feedback + previousOverview to run a
 * human-in-the-loop iteration that incorporates the user's wishes.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { generateConcept } from '@/lib/studio/concept'

export async function POST(req: NextRequest) {
  const authError = await requireAuth()
  if (authError) return authError
  let body: { goal?: string; context?: string; feedback?: string; previousOverview?: string }
  try { body = (await req.json()) as typeof body } catch { return NextResponse.json({ error: 'Ungültiger Body' }, { status: 400 }) }
  const goal = body.goal?.trim()
  if (!goal) return NextResponse.json({ error: 'goal ist erforderlich' }, { status: 400 })
  const concept = await generateConcept({
    goal, context: body.context, feedback: body.feedback?.trim() || undefined, previousOverview: body.previousOverview,
  })
  return NextResponse.json(concept)
}
