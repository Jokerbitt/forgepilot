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
}

export function selectDelegationExecutionMode(input: SelectExecutionModeInput): DelegationExecutionMode {
  if (input.executionRoute === 'ollama-agent') return 'ollama-agent'

  if (input.runnerReadiness.zeroKeyReady) {
    if (input.runnerReadiness.activeMode === 'claude-cli') return 'claude-cli'
    if (input.runnerReadiness.activeMode === 'codex-cli') return 'codex-cli'
  }

  if (input.anthropicApiKeySet) return 'claude-api'

  return 'simulation'
}
