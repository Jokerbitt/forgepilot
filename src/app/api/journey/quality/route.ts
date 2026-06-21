export const dynamic = 'force-dynamic'

/**
 * POST /api/journey/quality
 * Body: { delegationIds: string[] }
 * Returns: QualityReport (plain-German "how well was it checked")
 *
 * Extra idea — reads each delegation's Definition-of-Done quality verdict and
 * summarizes it in simple words.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { createDelegationRepository, SINGLE_TENANT_USER_ID } from '@/lib/repositories/delegationRepository'
import { humanizeQuality, type QualityInput } from '@/lib/journey/quality'

export async function POST(req: NextRequest) {
  const authError = await requireAuth()
  if (authError) return authError

  let body: { delegationIds?: string[] }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Ungültiger Body' }, { status: 400 })
  }

  const ids = Array.isArray(body.delegationIds) ? body.delegationIds.filter(id => typeof id === 'string' && id) : []
  if (ids.length === 0) return NextResponse.json({ error: 'delegationIds erforderlich' }, { status: 400 })

  const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
  const items: QualityInput[] = []
  for (const id of ids) {
    const d = await repo.findById(id)
    if (!d) continue
    items.push({ title: d.title, verdict: d.qualityCheck?.verdict, score: d.qualityCheck?.overallScore })
  }

  return NextResponse.json(humanizeQuality(items))
}
