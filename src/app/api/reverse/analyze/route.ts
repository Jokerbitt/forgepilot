export const dynamic = 'force-dynamic'

/**
 * POST /api/reverse/analyze
 * Body: { rootPath: string }
 * Returns: ReverseReport
 *
 * Read-only deep analysis of an existing app (multi-language incl. C#/.NET):
 * languages, frameworks, platform binding, database stack, modules, security and
 * tech-debt signals + a plain-German summary. No writes, no rebuild.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { analyzeForReverse } from '@/lib/reverse/analyze'

export async function POST(req: NextRequest) {
  const authError = await requireAuth()
  if (authError) return authError

  let body: { rootPath?: string }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Ungültiger Body' }, { status: 400 })
  }

  const rootPath = body.rootPath?.trim()
  if (!rootPath) return NextResponse.json({ error: 'rootPath ist erforderlich' }, { status: 400 })

  const report = analyzeForReverse(rootPath)
  return NextResponse.json(report)
}
