export const dynamic = 'force-dynamic'

/**
 * POST /api/reverse/parity
 * Body: { originalPath: string, rebuiltPath: string, migrateDatabase?: string }
 * Returns: ParityReport
 *
 * Analyzes the original app and its rebuild (both read-only) and reports which
 * modernization goals are demonstrably met — a structural parity overview, not
 * a proof of "logic 1:1" (that is the parity-test build step).
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { analyzeForReverse } from '@/lib/reverse/analyze'
import { buildParityReport } from '@/lib/reverse/parity-report'

export async function POST(req: NextRequest) {
  const authError = await requireAuth()
  if (authError) return authError

  let body: { originalPath?: string; rebuiltPath?: string; migrateDatabase?: string }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Ungültiger Body' }, { status: 400 })
  }

  const originalPath = body.originalPath?.trim()
  const rebuiltPath = body.rebuiltPath?.trim()
  if (!originalPath || !rebuiltPath) {
    return NextResponse.json({ error: 'originalPath und rebuiltPath sind erforderlich' }, { status: 400 })
  }

  const original = analyzeForReverse(originalPath)
  const rebuilt = analyzeForReverse(rebuiltPath)
  const migrateDatabase = typeof body.migrateDatabase === 'string' ? body.migrateDatabase : undefined
  return NextResponse.json(buildParityReport(original, rebuilt, { migrateDatabase }))
}
