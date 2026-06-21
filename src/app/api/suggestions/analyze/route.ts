export const dynamic = 'force-dynamic'

/**
 * POST /api/suggestions/analyze
 * Body: { targetRepo: string, focus?: string, count?: number }
 * Returns: { analysis: CodebaseAnalysis, suggestions: Suggestion[] }
 *
 * Analyzes an EXISTING app's repo and proposes context-aware improvement
 * suggestions grounded in that analysis. The user then selects some (plus an
 * optional custom step) and sends them to /api/suggestions/build with the same
 * targetRepo — the build flow recognizes the existing repo and won't recreate it.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { analyzeCodebase } from '@/lib/suggestions/codebase-analyzer'
import { generateImprovementSuggestions } from '@/lib/suggestions/generator'

export async function POST(req: NextRequest) {
  const authError = await requireAuth()
  if (authError) return authError

  let body: { targetRepo?: string; focus?: string; count?: number }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Ungültiger Body' }, { status: 400 })
  }

  const targetRepo = body.targetRepo?.trim()
  if (!targetRepo) return NextResponse.json({ error: 'targetRepo ist erforderlich' }, { status: 400 })

  const count = typeof body.count === 'number' ? Math.min(8, Math.max(2, body.count)) : 5
  const analysis = analyzeCodebase(targetRepo)
  const suggestions = await generateImprovementSuggestions({ analysis, focus: body.focus, count })

  return NextResponse.json({ analysis, suggestions })
}
