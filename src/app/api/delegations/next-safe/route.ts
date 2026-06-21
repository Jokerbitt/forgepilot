/**
 * GET  /api/delegations/next-safe
 *   Returns the highest-priority delegation that is safe to start automatically:
 *   - status: 'approved' (already cleared for execution)
 *   - riskClass: A (or within autopilotMaxRiskClass)
 *   - autopilot score >= autopilotMinScore
 *   - not currently at max concurrent agents
 *
 * POST /api/delegations/next-safe
 *   Approves + immediately starts the next safe delegation.
 *   Idempotent: if none qualifies, returns 204.
 */
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { apiLogger } from '@/lib/logger'
import { getNBAConfig } from '@/lib/nba-engine/nba-config'
import { computeAutopilotScore } from '@/lib/nba-engine/autopilot-score'
import { pickNextSafe, type NextSafeResult } from '@/lib/delegations/next-safe'
import {
  createDelegationRepository,
  SINGLE_TENANT_USER_ID,
} from '@/lib/repositories/delegationRepository'
import type { Delegation } from '@/lib/models/delegation'

export async function GET() {
  const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
  const config = getNBAConfig()

  let all: Delegation[]
  try {
    all = await repo.listByStatus()
  } catch (err) {
    apiLogger.error({ err, event: 'next-safe.list.error' }, 'Failed to load delegations')
    return NextResponse.json({ error: 'Failed to load delegations' }, { status: 500 })
  }

  const { candidate, runningCount } = pickNextSafe(all, {
    autopilotMinScore: config.autopilotMinScore,
    autopilotMaxRiskClass: config.autopilotMaxRiskClass,
    maxConcurrentAgents: config.maxConcurrentAgents,
  })

  if (!candidate) {
    return NextResponse.json({ delegation: null, runningCount, maxConcurrentAgents: config.maxConcurrentAgents })
  }

  const { score, label, reasons } = computeAutopilotScore(candidate.contract)

  const result: NextSafeResult = {
    delegation: candidate,
    autopilotScore: score,
    autopilotLabel: label,
    reasons,
    runningCount,
    maxConcurrentAgents: config.maxConcurrentAgents,
  }

  return NextResponse.json(result)
}

export async function POST() {
  const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
  const config = getNBAConfig()

  let all: Delegation[]
  try {
    all = await repo.listByStatus()
  } catch (err) {
    apiLogger.error({ err, event: 'next-safe.post.list.error' }, 'Failed to load delegations')
    return NextResponse.json({ error: 'Failed to load delegations' }, { status: 500 })
  }

  const { candidate, runningCount } = pickNextSafe(all, {
    autopilotMinScore: config.autopilotMinScore,
    autopilotMaxRiskClass: config.autopilotMaxRiskClass,
    maxConcurrentAgents: config.maxConcurrentAgents,
  })

  if (!candidate) {
    apiLogger.info(
      { runningCount, maxConcurrentAgents: config.maxConcurrentAgents, event: 'next-safe.none' },
      'No safe delegation available to start',
    )
    return new NextResponse(null, { status: 204 })
  }

  // Approve if still pending
  if (candidate.status === 'pending') {
    await repo.update(candidate.id, { status: 'approved' })
    apiLogger.info({ delegationId: candidate.id, event: 'next-safe.auto-approved' }, 'Auto-approved delegation')
  }

  // Trigger execution via internal fetch to the execute route (reuses all execute logic)
  const executeUrl = new URL(
    `/api/delegations/${candidate.id}/execute`,
    process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  )

  try {
    const execRes = await fetch(executeUrl.toString(), { method: 'POST' })
    if (!execRes.ok) {
      const body = await execRes.text().catch(() => '')
      apiLogger.error(
        { delegationId: candidate.id, status: execRes.status, body, event: 'next-safe.execute.error' },
        'Execute route returned error',
      )
      return NextResponse.json({ error: 'Execute route failed', delegationId: candidate.id }, { status: 502 })
    }
  } catch (err) {
    apiLogger.error({ err, delegationId: candidate.id, event: 'next-safe.execute.fetch.error' }, 'Execute fetch failed')
    return NextResponse.json({ error: 'Could not reach execute route' }, { status: 502 })
  }

  const { score, label, reasons } = computeAutopilotScore(candidate.contract)

  apiLogger.info(
    { delegationId: candidate.id, score, runningCount, event: 'next-safe.started' },
    'Next safe delegation started',
  )

  return NextResponse.json({
    started: true,
    delegation: { ...candidate, status: 'running' },
    autopilotScore: score,
    autopilotLabel: label,
    reasons,
    runningCount: runningCount + 1,
    maxConcurrentAgents: config.maxConcurrentAgents,
  } satisfies NextSafeResult & { started: boolean })
}
