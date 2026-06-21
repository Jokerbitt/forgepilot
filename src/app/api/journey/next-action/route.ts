export const dynamic = 'force-dynamic'

/**
 * POST /api/journey/next-action
 * Body: { targetRepo: string }
 * Returns: { actions: NextAction[] }
 *
 * Extra idea — "Was als Nächstes?" assistant: prioritised, plain-German next
 * steps based on the app's real state.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { suggestNextActions } from '@/lib/journey/next-action'

export async function POST(req: NextRequest) {
  const authError = await requireAuth()
  if (authError) return authError

  let body: { targetRepo?: string }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Ungültiger Body' }, { status: 400 })
  }

  const targetRepo = body.targetRepo?.trim()
  if (!targetRepo) return NextResponse.json({ error: 'targetRepo ist erforderlich' }, { status: 400 })

  return NextResponse.json({ actions: suggestNextActions(targetRepo) })
}
