import { describe, it, expect } from 'vitest'
import type { TaskContract } from '@/lib/models/delegation'
import { resolvePolicyGate, isPolicyEnforced } from './gate'

function contract(overrides: Partial<TaskContract> = {}): TaskContract {
  return {
    id: 'tc-1',
    workItemId: 'wi-1',
    goal: 'Implement feature X',
    context: 'Some context',
    definitionOfDone: ['Tests pass', 'PR merged'],
    riskClass: 'A',
    maxBudgetUsd: 5,
    allowedTools: ['Bash', 'Read', 'Write'],
    branchStrategy: 'feature',
    requiresApproval: false,
    privacyMode: 'local',
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('isPolicyEnforced', () => {
  it('defaults to report-only (false) when the flag is unset', () => {
    expect(isPolicyEnforced({} as NodeJS.ProcessEnv)).toBe(false)
  })

  it('arms on the documented truthy values', () => {
    for (const v of ['1', 'true', 'on', 'yes', 'TRUE', ' On ']) {
      expect(isPolicyEnforced({ FORGEPILOT_POLICY_ENFORCE: v } as unknown as NodeJS.ProcessEnv), v).toBe(true)
    }
  })

  it('stays report-only for other / falsy values', () => {
    for (const v of ['0', 'false', 'off', 'no', '']) {
      expect(isPolicyEnforced({ FORGEPILOT_POLICY_ENFORCE: v } as unknown as NodeJS.ProcessEnv), v).toBe(false)
    }
  })
})

describe('resolvePolicyGate', () => {
  it('report-only: a clean contract is allowed and never blocked', () => {
    const result = resolvePolicyGate(contract(), { enforce: false })
    expect(result.decision.verdict).toBe('allow')
    expect(result.blocked).toBe(false)
  })

  it('report-only: a deny verdict (Risk-C) is surfaced but NOT blocked', () => {
    const result = resolvePolicyGate(contract({ riskClass: 'C' }), { enforce: false })
    expect(result.decision.verdict).toBe('deny')
    expect(result.blocked).toBe(false)
  })

  it('enforce: a deny verdict (Risk-C) blocks the run', () => {
    const result = resolvePolicyGate(contract({ riskClass: 'C' }), { enforce: true })
    expect(result.decision.verdict).toBe('deny')
    expect(result.blocked).toBe(true)
  })

  it('enforce: a deny verdict (secret tool) blocks the run', () => {
    const result = resolvePolicyGate(contract({ allowedTools: ['Bash', 'read-api-key'] }), { enforce: true })
    expect(result.decision.verdict).toBe('deny')
    expect(result.blocked).toBe(true)
  })

  it('enforce: a clean contract is allowed and not blocked', () => {
    const result = resolvePolicyGate(contract(), { enforce: true })
    expect(result.decision.verdict).toBe('allow')
    expect(result.blocked).toBe(false)
  })

  it('enforce: a review verdict (warning only) is not blocked', () => {
    // missing DoD → dod-required warning → verdict 'review', not 'deny'
    const result = resolvePolicyGate(contract({ definitionOfDone: [] }), { enforce: true })
    expect(result.decision.verdict).toBe('review')
    expect(result.blocked).toBe(false)
  })
})
