export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { getNBAConfig } from '@/lib/nba-engine/nba-config'
import { computeAutopilotScore } from '@/lib/nba-engine/autopilot-score'
import { pickNextSafe } from '@/lib/delegations/next-safe'
import { reapStaleDelegations } from '@/lib/delegations/watchdog'
import {
  assessDelegationActionability,
  buildAutonomyRefinementPatch,
  isAutonomyRefined,
} from '@/lib/delegations/autonomy-refinement'
import {
  getCachedOrShallowRunnerReadiness,
  getRunnerReadiness,
  writeCachedRunnerReadiness,
} from '@/lib/system/runner-readiness'
import {
  createDelegationRepository,
  SINGLE_TENANT_USER_ID,
} from '@/lib/repositories/delegationRepository'
import type { Delegation } from '@/lib/models/delegation'

interface AutonomyCycleRequest {
  force?: boolean
  dryRun?: boolean
  timeoutMinutes?: number
}

function countDelegations(delegations: Delegation[]) {
  return {
    total: delegations.length,
    failed: delegations.filter(d => d.status === 'failed').length,
    running: delegations.filter(d => d.status === 'running').length,
    approved: delegations.filter(d => d.status === 'approved').length,
    pending: delegations.filter(d => d.status === 'pending').length,
  }
}

function internalBaseUrl(): string {
  return process.env.FORGEPILOT_INTERNAL_BASE_URL
    ?? process.env.NEXTAUTH_URL
    ?? process.env.NEXT_PUBLIC_APP_URL
    ?? 'http://localhost:3026'
}

function candidatePayload(candidate: Delegation | null) {
  if (!candidate) return null
  const score = computeAutopilotScore(candidate.contract)
  return {
    id: candidate.id,
    title: candidate.title ?? candidate.contract.goal,
    status: candidate.status,
    riskClass: candidate.contract.riskClass,
    autopilotScore: score.score,
    autopilotLabel: score.label,
    reasons: score.reasons,
    href: `/delegations/${candidate.id}`,
  }
}

export async function POST(request: NextRequest) {
  const authError = await requireAuth()
  if (authError) return authError

  const body = await request.json().catch(() => ({})) as AutonomyCycleRequest
  const config = getNBAConfig()
  const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
  const timeoutMinutes = Math.max(5, Math.min(240, Number(body.timeoutMinutes ?? 10)))
  let runnerReadiness = getCachedOrShallowRunnerReadiness()
  let delivery: unknown = null

  if (!body.dryRun && !runnerReadiness.ready) {
    runnerReadiness = getRunnerReadiness({ deep: true })
    writeCachedRunnerReadiness(runnerReadiness)

    if (!runnerReadiness.ready) {
      return NextResponse.json({
        ok: true,
        status: 'blocked',
        message: 'Autonomie bleibt blockiert: kein echter Runner ist headless bereit. Bitte Claude Code oder Codex CLI anmelden oder einen API-Fallback konfigurieren.',
        runnerReadiness,
        delivery,
        counts: null,
        candidate: null,
        started: false,
      })
    }
  }

  if (!body.dryRun) {
    const deliveryResponse = await fetch(new URL('/api/daily-assistant/delivery-cycle', internalBaseUrl()).toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: request.headers.get('cookie') ?? '',
      },
      body: JSON.stringify({ force: body.force }),
    }).catch(() => null)
    delivery = deliveryResponse
      ? await deliveryResponse.json().catch(() => null)
      : null
  }

  const reaped = await reapStaleDelegations(repo, { runningSilentMinutes: timeoutMinutes })
  const delegations = await repo.listByStatus()
  const counts = countDelegations(delegations)

  if (counts.failed > 0 && !body.force) {
    return NextResponse.json({
      ok: true,
      status: 'blocked',
      message: `${counts.failed} fehlgeschlagene Delegation(en) blockieren Autonomie. Bitte erst Fehler prüfen oder bewusst erneut starten.`,
      reaped,
      delivery,
      runnerReadiness,
      counts,
      candidate: null,
      started: false,
    })
  }

  const skippedCandidates: Array<{
    candidate: ReturnType<typeof candidatePayload>
    reason: string
    nextStep?: string
    refined?: boolean
  }> = []
  const refinedCandidates: Array<{
    id: string
    title: string
    reason: string
  }> = []
  let remainingDelegations = delegations
  let selection = pickNextSafe(remainingDelegations, {
    autopilotMinScore: config.autopilotMinScore,
    autopilotMaxRiskClass: config.autopilotMaxRiskClass,
    maxConcurrentAgents: config.maxConcurrentAgents,
  })
  let { candidate, runningCount } = selection

  while (candidate) {
    const actionability = assessDelegationActionability(candidate)
    if (actionability.ok) break

    if (!body.dryRun && !isAutonomyRefined(candidate)) {
      const refinement = buildAutonomyRefinementPatch(candidate)
      const refined = await repo.update(candidate.id, refinement.patch)
      if (refined) {
        refinedCandidates.push({
          id: refined.id,
          title: refined.title,
          reason: refinement.reason,
        })
        candidate = refined
        const refinedActionability = assessDelegationActionability(candidate)
        if (refinedActionability.ok) break
      }
    }

    skippedCandidates.push({
      candidate: candidatePayload(candidate),
      reason: actionability.reason ?? 'Aufgabe ist nicht konkret genug.',
      nextStep: actionability.nextStep,
      refined: false,
    })
    remainingDelegations = remainingDelegations.filter(delegation => delegation.id !== candidate?.id)
    selection = pickNextSafe(remainingDelegations, {
      autopilotMinScore: config.autopilotMinScore,
      autopilotMaxRiskClass: config.autopilotMaxRiskClass,
      maxConcurrentAgents: config.maxConcurrentAgents,
    })
    candidate = selection.candidate
    runningCount = selection.runningCount
  }

  if (!candidate) {
    if (skippedCandidates.length > 0) {
      return NextResponse.json({
        ok: true,
        status: 'needs_refinement',
        message: 'Assistant hat keine konkret ausfuehrbare Delegation gefunden. Vage Aufgaben wurden uebersprungen.',
        nextStep: 'Nutze den Plan-Modus, um aus der Idee ein enges Arbeitspaket mit Ziel, Scope, Dateigrenzen und Definition of Done zu machen.',
        reaped,
        delivery,
        runnerReadiness,
        counts,
        runningCount,
        skippedCandidates,
        refinedCandidates,
        candidate: null,
        started: false,
      })
    }

    return NextResponse.json({
      ok: true,
      status: runningCount >= config.maxConcurrentAgents ? 'waiting' : 'idle',
      message: runningCount >= config.maxConcurrentAgents
        ? `Maximal ${config.maxConcurrentAgents} Agent(en) laufen bereits. Assistant wartet.`
        : 'Keine sichere freigegebene Delegation startbereit. Plane eine neue Idee oder gib die naechste Aufgabe frei.',
      reaped,
      delivery,
      runnerReadiness,
      counts,
      runningCount,
      candidate: null,
      started: false,
    })
  }

  if (body.dryRun || (config.approvalMode !== 'autopilot' && !body.force)) {
    return NextResponse.json({
      ok: true,
      status: 'ready',
      message: config.approvalMode === 'autopilot'
        ? 'Sichere Delegation startbereit.'
        : 'Balanced/Kontrollmodus: sichere Delegation gefunden. Starte sie bewusst mit Assistant uebernehmen.',
      reaped,
      delivery,
      runnerReadiness,
      counts,
      runningCount,
      skippedCandidates,
      refinedCandidates,
      candidate: candidatePayload(candidate),
      started: false,
    })
  }

  if (candidate.status === 'pending') {
    await repo.update(candidate.id, { status: 'approved' })
  }

  const executeUrl = new URL(`/api/delegations/${encodeURIComponent(candidate.id)}/execute`, internalBaseUrl())
  const executeResponse = await fetch(executeUrl.toString(), {
    method: 'POST',
    headers: {
      cookie: request.headers.get('cookie') ?? '',
    },
  })

  if (!executeResponse.ok) {
    const errorBody = await executeResponse.text().catch(() => '')
    return NextResponse.json({
      ok: false,
      status: 'start_failed',
      message: `Assistant konnte die Delegation nicht starten (HTTP ${executeResponse.status}).`,
      error: errorBody.slice(0, 500),
      reaped,
      delivery,
      runnerReadiness,
      counts,
      skippedCandidates,
      refinedCandidates,
      candidate: candidatePayload(candidate),
      started: false,
    }, { status: 502 })
  }

  const execution = await executeResponse.json().catch(() => ({})) as Record<string, unknown>

  return NextResponse.json({
    ok: true,
    status: 'started',
    message: 'Assistant hat die naechste sichere Delegation gestartet und ueberwacht sie jetzt in der Live View.',
    reaped,
    delivery,
    runnerReadiness,
    counts,
    runningCount: runningCount + 1,
    skippedCandidates,
    refinedCandidates,
    candidate: candidatePayload(candidate),
    started: true,
    execution,
  })
}
