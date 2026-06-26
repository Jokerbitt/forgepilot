import type { RunnerReadiness } from '@/lib/system/runner-readiness'

export type DelegationExecutionMode =
  | 'ollama-agent'
  | 'claude-cli'
  | 'codex-cli'
  | 'claude-api'
  | 'simulation'

export interface SelectExecutionModeInput {
  executionRoute?: string
  runnerReadiness: Pick<RunnerReadiness, 'zeroKeyReady' | 'activeMode'>
  anthropicApiKeySet: boolean
  /**
   * Whether the local Ollama agent is reachable. Used as the fallback when no
   * cloud provider is available, so an unattended run survives a dead/expired
   * cloud credential by going local instead of degrading to a no-op simulation.
   */
  ollamaReady?: boolean
}

export function selectDelegationExecutionMode(input: SelectExecutionModeInput): DelegationExecutionMode {
  if (input.executionRoute === 'ollama-agent') return 'ollama-agent'

  if (input.runnerReadiness.zeroKeyReady) {
    if (input.runnerReadiness.activeMode === 'claude-cli') return 'claude-cli'
    if (input.runnerReadiness.activeMode === 'codex-cli') return 'codex-cli'
  }

  if (input.anthropicApiKeySet) return 'claude-api'

  // Cloud unavailable (no live CLI token, no funded API key). Prefer the local
  // Ollama agent over a no-op simulation — this is what keeps the runner working
  // unattended when the Claude token expires / runs out of credit, instead of
  // hard-failing the delegation.
  if (input.ollamaReady) return 'ollama-agent'

  return 'simulation'
}

/**
 * Runner modes that spawn an agent with the `--dangerously-*` flags, i.e. with the
 * agent runtime's own permission/sandbox gating disabled (Claude CLI:
 * --dangerously-skip-permissions; Codex: --dangerously-bypass-approvals-and-sandbox).
 *
 * ADR-003 D3: a Risk-C delegation must NEVER run through one of these. Risk-C is
 * already blocked upstream by the enforced policy gate (D1) and the human-approval
 * choke-point (D2); this predicate powers a third, fail-closed defense at the spawn
 * point in case either is ever bypassed by a bug.
 */
export function isDangerousRunnerMode(mode: DelegationExecutionMode): boolean {
  return mode === 'claude-cli' || mode === 'codex-cli'
}
