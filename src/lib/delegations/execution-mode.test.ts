import { describe, expect, it } from 'vitest'
import { selectDelegationExecutionMode } from './execution-mode'

describe('selectDelegationExecutionMode', () => {
  it('uses Ollama when explicitly routed there', () => {
    expect(selectDelegationExecutionMode({
      executionRoute: 'ollama-agent',
      runnerReadiness: { zeroKeyReady: true, activeMode: 'claude-cli' },
      anthropicApiKeySet: true,
    })).toBe('ollama-agent')
  })

  it('requires headless zero-key readiness before using Claude CLI', () => {
    expect(selectDelegationExecutionMode({
      runnerReadiness: { zeroKeyReady: false, activeMode: 'claude-cli' },
      anthropicApiKeySet: false,
    })).toBe('simulation')
  })

  it('prefers Claude CLI when zero-key readiness is confirmed', () => {
    expect(selectDelegationExecutionMode({
      runnerReadiness: { zeroKeyReady: true, activeMode: 'claude-cli' },
      anthropicApiKeySet: true,
    })).toBe('claude-cli')
  })

  it('falls back to Codex CLI when that is the ready zero-key runner', () => {
    expect(selectDelegationExecutionMode({
      runnerReadiness: { zeroKeyReady: true, activeMode: 'codex-cli' },
      anthropicApiKeySet: true,
    })).toBe('codex-cli')
  })

  it('uses Claude API only when no zero-key runner is ready', () => {
    expect(selectDelegationExecutionMode({
      runnerReadiness: { zeroKeyReady: false, activeMode: 'claude-api' },
      anthropicApiKeySet: true,
    })).toBe('claude-api')
  })
})
