/**
 * Multi-phase build gate decision (pure).
 *
 * Between chained build phases the next phase must NOT start on a broken
 * foundation (M230). The build gate already enforced a green `npm run build`;
 * this adds a test gate so a phase with a green build but RED tests also stops
 * the chain. A test TIMEOUT is treated as an infrastructure signal (slow CI /
 * missing install), never a code failure, so it must not block the chain.
 *
 * Kept pure + unit-testable; the execute route runs the actual build/test and
 * feeds the booleans in.
 */

export interface PhaseGateInput {
  /** `npm run build` exited 0 (or there was no build script). */
  buildPassed: boolean
  /** No build script present — the build step was skipped. */
  buildSkipped?: boolean
  /** `npm run test:run` exited 0 (or there was no test script). */
  testPassed: boolean
  /** The test run hit its time limit — infra signal, not a code failure. */
  testTimedOut?: boolean
  /** No test script present — the test step was skipped. */
  testSkipped?: boolean
}

export interface PhaseGateDecision {
  /** Whether the next chain phase may start. */
  proceed: boolean
  /** Plain-German reason for the log / failure message. */
  reason: string
}

/**
 * Decide whether the next phase may start. Build must be green; tests must be
 * green unless they were skipped (no script) or timed out (infra, not code).
 */
export function decidePhaseGate(input: PhaseGateInput): PhaseGateDecision {
  if (!input.buildPassed) {
    return {
      proceed: false,
      reason: 'Build-Gate fehlgeschlagen: npm run build war nicht grün — Chain gestoppt um Folgefehler zu vermeiden.',
    }
  }

  if (input.testTimedOut) {
    return {
      proceed: true,
      reason: 'Tests liefen in einen Timeout (Infrastruktur-Signal, kein Code-Fehler) — Phase wird fortgesetzt.',
    }
  }

  if (!input.testPassed && !input.testSkipped) {
    return {
      proceed: false,
      reason: 'Test-Gate fehlgeschlagen: npm run test:run war nicht grün — Chain gestoppt um Folgefehler zu vermeiden.',
    }
  }

  const buildNote = input.buildSkipped ? 'kein Build-Script' : 'Build grün'
  const testNote = input.testSkipped ? 'kein Test-Script' : 'Tests grün'
  return { proceed: true, reason: `Build-Gate ok (${buildNote}, ${testNote}) — nächste Phase wird gestartet.` }
}
