export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { execFileSync } from 'child_process'
import { createDelegationRepository, SINGLE_TENANT_USER_ID } from '@/lib/repositories/delegationRepository'
import type { Delegation } from '@/lib/models/delegation'

export interface GateResult {
  name: string
  passed: boolean
  detail: string
}

export interface AutoMergeResponse {
  merged: boolean
  gates: GateResult[]
  blockedBy?: string
}

/**
 * Evaluate all safety gates for a delegation before auto-merging its PR.
 * Returns the list of gate results and the first blocking gate name (if any).
 */
export function evaluateSafetyGates(delegation: Delegation): {
  gates: GateResult[]
  blockedBy: string | undefined
} {
  const report = delegation.summaryReport
  const gates: GateResult[] = []

  // Gate 1: Status must be completed
  const statusGate: GateResult = {
    name: 'Status abgeschlossen',
    passed: delegation.status === 'completed',
    detail: `Status ist "${delegation.status}" — erwartet: "completed"`,
  }
  gates.push(statusGate)

  // Gate 2: PR URL must exist
  const prUrlGate: GateResult = {
    name: 'PR vorhanden',
    passed: !!report?.prUrl,
    detail: report?.prUrl ? `PR URL: ${report.prUrl}` : 'Kein PR URL in summaryReport gefunden',
  }
  gates.push(prUrlGate)

  // Gate 3: PR must not already be merged
  const prStateGate: GateResult = {
    name: 'PR noch offen',
    passed: report?.prState !== 'merged',
    detail: report?.prState === 'merged'
      ? 'PR ist bereits gemergt'
      : `PR-Status: ${report?.prState ?? 'unbekannt (open angenommen)'}`,
  }
  gates.push(prStateGate)

  // Gate 4: Risk Class must not be C
  const riskGate: GateResult = {
    name: 'Kein Risk-Class-C',
    passed: delegation.contract.riskClass !== 'C',
    detail: delegation.contract.riskClass === 'C'
      ? 'Risk Class C erfordert manuellen Merge'
      : `Risk Class: ${delegation.contract.riskClass}`,
  }
  gates.push(riskGate)

  // Gate 5: Tests passed OR quality check verdict is 'passed'
  const testsPassed = (report?.testsPassed ?? 0) > 0
  const qualityOk = (delegation as Delegation & { qualityCheck?: { verdict: string } }).qualityCheck?.verdict === 'passed'
  const testsGate: GateResult = {
    name: 'Tests bestanden',
    passed: testsPassed || qualityOk,
    detail: testsPassed
      ? `${report?.testsPassed ?? 0} Tests bestanden`
      : qualityOk
        ? 'Quality-Check Verdict: passed'
        : 'Keine bestandenen Tests und kein positiver Quality-Check',
  }
  gates.push(testsGate)

  // Gate 6: Changes must be manageable (< 500 lines total, if available)
  const linesTotal = (report?.linesAdded ?? 0) + (report?.linesRemoved ?? 0)
  const linesAvailable = (report?.linesAdded !== undefined || report?.linesRemoved !== undefined)
  const linesGate: GateResult = {
    name: 'Überschaubare Änderungen',
    passed: !linesAvailable || linesTotal < 500,
    detail: linesAvailable
      ? `${linesTotal} Zeilen geändert (Limit: 500)`
      : 'Keine Zeileninformation verfügbar — Gate übersprungen',
  }
  gates.push(linesGate)

  // Gate 7: Critic score must be >= 70 (if available)
  const hasCriticScore = delegation.criticScore !== undefined
  const criticOk = !hasCriticScore || (delegation.criticScore?.correctness ?? 0) >= 70
  const criticGate: GateResult = {
    name: 'Critic-Score ausreichend',
    passed: criticOk,
    detail: hasCriticScore
      ? `Critic-Score: ${delegation.criticScore?.correctness ?? 0}/100 (Minimum: 70)`
      : 'Kein Critic-Score vorhanden — Gate übersprungen',
  }
  gates.push(criticGate)

  // Find first failing gate
  const failing = gates.find(g => !g.passed)
  return { gates, blockedBy: failing?.name }
}

/**
 * POST /api/delegations/[id]/auto-merge
 *
 * Merges the GitHub PR for a delegation only when all safety gates pass.
 * Uses `gh pr merge <prUrl> --squash --auto` to trigger GitHub's auto-merge.
 *
 * Response: { merged: boolean, gates: GateResult[], blockedBy?: string }
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
  const delegation = await repo.findById(id)

  if (!delegation) {
    return NextResponse.json({ error: 'Delegation nicht gefunden' }, { status: 404 })
  }

  const { gates, blockedBy } = evaluateSafetyGates(delegation)

  if (blockedBy) {
    const response: AutoMergeResponse = { merged: false, gates, blockedBy }
    return NextResponse.json(response, { status: 422 })
  }

  // All gates passed — execute gh pr merge
  const prUrl = delegation.summaryReport!.prUrl!

  try {
    execFileSync(
      'gh',
      ['pr', 'merge', prUrl, '--squash', '--auto'],
      { encoding: 'utf-8', timeout: 30_000, stdio: 'pipe' },
    )
  } catch (err) {
    return NextResponse.json(
      {
        merged: false,
        gates,
        blockedBy: `gh pr merge fehlgeschlagen: ${String(err)}`,
      } satisfies AutoMergeResponse,
      { status: 500 },
    )
  }

  // Update delegation: mark PR as merged
  await repo.update(id, {
    summaryReport: {
      keyPoints: delegation.summaryReport?.keyPoints ?? [],
      changes: delegation.summaryReport?.changes ?? [],
      timeTakenMinutes: delegation.summaryReport?.timeTakenMinutes ?? 0,
      ...delegation.summaryReport,
      prState: 'merged',
      prMergedAt: new Date().toISOString(),
    },
  })

  const response: AutoMergeResponse = { merged: true, gates }
  return NextResponse.json(response)
}
