export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { createDelegationRepository, SINGLE_TENANT_USER_ID } from '@/lib/repositories/delegationRepository'
import { getNBAConfig } from '@/lib/nba-engine/nba-config'
import { computeAutopilotScore } from '@/lib/nba-engine/autopilot-score'

/**
 * POST /api/loop/start
 *
 * "Loop starten" — the one-click morning kickoff:
 * 1. Finds all pending Risk A/B delegations within autopilot score threshold
 * 2. Approves them automatically (sets status → approved)
 * 3. Triggers the next safe delegation via /api/delegations/next-safe
 *
 * Returns: { approved: number, started: boolean, delegationId?: string }
 */
export async function POST() {
  const authError = await requireAuth()
  if (authError) return authError

  const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
  const config = getNBAConfig()
  const all = await repo.listByStatus()

  // Find pending delegations that are safe to auto-approve
  const pendingCandidates = all.filter(d => {
    if (d.status !== 'pending') return false
    if (d.contract.riskClass === 'C') return false // Risk C always needs manual approval
    const { score } = computeAutopilotScore(d.contract)
    return score >= config.autopilotMinScore
  })

  // Auto-approve all candidates
  let approved = 0
  for (const d of pendingCandidates) {
    await repo.update(d.id, { status: 'approved' })
    approved++
  }

  // Trigger the next safe delegation
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
  let started = false
  let delegationId: string | undefined

  try {
    const res = await fetch(`${baseUrl}/api/delegations/next-safe`, { method: 'POST' })
    if (res.ok) {
      const data = await res.json() as { started?: boolean; delegation?: { id: string } }
      started = data.started ?? false
      delegationId = data.delegation?.id
    }
  } catch { /* non-critical */ }

  return NextResponse.json({ approved, started, delegationId })
}
