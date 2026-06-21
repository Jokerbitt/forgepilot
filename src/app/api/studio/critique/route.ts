export const dynamic = 'force-dynamic'

/**
 * POST /api/studio/critique
 * Body: { goal, overview, features?: string[] }
 * Returns: Critique { pros[], cons[], considerations[], verdict, hasFeedback }
 *
 * A skeptical critic LLM reviews the blueprint for decision support before build.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { critiqueConcept } from '@/lib/studio/critic'

export async function POST(req: NextRequest) {
  const authError = await requireAuth()
  if (authError) return authError
  let body: { goal?: string; overview?: string; features?: string[] }
  try { body = (await req.json()) as typeof body } catch { return NextResponse.json({ error: 'Ungültiger Body' }, { status: 400 }) }
  const goal = body.goal?.trim()
  const overview = body.overview?.trim()
  if (!goal || !overview) return NextResponse.json({ error: 'goal und overview sind erforderlich' }, { status: 400 })
  const features = Array.isArray(body.features) ? body.features.filter((f): f is string => typeof f === 'string') : undefined
  const critique = await critiqueConcept({ goal, overview, features })
  return NextResponse.json(critique)
}
