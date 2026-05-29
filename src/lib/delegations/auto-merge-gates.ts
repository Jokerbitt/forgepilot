/**
 * auto-merge-gates.ts — Safety gate evaluation for PR auto-merge (M7).
 *
 * Extracted from route.ts so it can be unit-tested without Next.js constraints.
 * Route files must only export HTTP handlers per Next.js App Router rules.
 */

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
 *
 * Gates that cannot be evaluated (missing data) are skipped (passed=true).
 */
export function evaluateSafetyGates(delegation: Delegation): {
  gates: GateResult[]
  blockedBy: string | undefined
} {
  const report = delegation.summaryReport
  const gates: GateResult[] = []

  // Gate 1: Status must be completed
  gates.push({
    name: 'Status abgeschlossen',
    passed: delegation.status === 'completed',
    detail: `Status ist "${delegation.status}" — erwartet: "completed"`,
  })

  // Gate 2: PR URL must exist
  gates.push({
    name: 'PR vorhanden',
    passed: !!report?.prUrl,
    detail: report?.prUrl ? `PR URL: ${report.prUrl}` : 'Kein PR URL in summaryReport gefunden',
  })

  // Gate 3: PR must not already be merged
  gates.push({
    name: 'PR noch offen',
    passed: report?.prState !== 'merged',
    detail: report?.prState === 'merged'
      ? 'PR ist bereits gemergt'
      : `PR-Status: ${report?.prState ?? 'unbekannt (open angenommen)'}`,
  })

  // Gate 4: Risk Class must not be C
  gates.push({
    name: 'Kein Risk-Class-C',
    passed: delegation.contract.riskClass !== 'C',
    detail: delegation.contract.riskClass === 'C'
      ? 'Risk Class C erfordert manuellen Merge'
      : `Risk Class: ${delegation.contract.riskClass}`,
  })

  // Gate 5: Tests passed OR quality check verdict is 'passed'
  const testsPassed = (report?.testsPassed ?? 0) > 0
  const qualityOk = delegation.qualityCheck?.verdict === 'passed'
  gates.push({
    name: 'Tests bestanden',
    passed: testsPassed || qualityOk,
    detail: testsPassed
      ? `${report?.testsPassed ?? 0} Tests bestanden`
      : qualityOk
        ? 'Quality-Check Verdict: passed'
        : 'Keine bestandenen Tests und kein positiver Quality-Check',
  })

  // Gate 6: Changes must be manageable (< 500 lines total, if available)
  const linesTotal = (report?.linesAdded ?? 0) + (report?.linesRemoved ?? 0)
  const linesAvailable = report?.linesAdded !== undefined || report?.linesRemoved !== undefined
  gates.push({
    name: 'Überschaubare Änderungen',
    passed: !linesAvailable || linesTotal < 500,
    detail: linesAvailable
      ? `${linesTotal} Zeilen geändert (Limit: 500)`
      : 'Keine Zeileninformation verfügbar — Gate übersprungen',
  })

  // Gate 7: Critic score must be >= 70 (if available)
  const hasCriticScore = delegation.criticScore !== undefined
  const criticOk = !hasCriticScore || (delegation.criticScore?.correctness ?? 0) >= 70
  gates.push({
    name: 'Critic-Score ausreichend',
    passed: criticOk,
    detail: hasCriticScore
      ? `Critic-Score: ${delegation.criticScore?.correctness ?? 0}/100 (Minimum: 70)`
      : 'Kein Critic-Score vorhanden — Gate übersprungen',
  })

  const failing = gates.find(g => !g.passed)
  return { gates, blockedBy: failing?.name }
}
