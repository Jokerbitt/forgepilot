export const dynamic = 'force-dynamic'

/**
 * POST /api/suggestions
 * Body: { goal: string, context?: string, count?: number }
 * Returns: { suggestions: Suggestion[] }
 *
 * Generates selectable next-step suggestions for a goal/context. Falls back to
 * an empty list (the UI shows a "type your own" path) when AI is unavailable.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { generateSuggestions } from '@/lib/suggestions/generator'

export async function POST(req: NextRequest) {
  const authError = await requireAuth()
  if (authError) return authError

  let body: { goal?: string; context?: string; count?: number }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Ungültiger Body' }, { status: 400 })
  }
  const goal = body.goal?.trim()
  if (!goal) return NextResponse.json({ error: 'goal ist erforderlich' }, { status: 400 })

  const count = typeof body.count === 'number' ? Math.min(8, Math.max(2, body.count)) : 5
  const suggestions = await generateSuggestions({ goal, context: body.context, count })
  return NextResponse.json({ suggestions })
}
