import { describe, it, expect } from 'vitest'

// ─── Logic helpers mirroring QuickDelegateWidget validation ──────────────────

function canSubmit(goal: string, phase: string): boolean {
  return goal.trim().length >= 20 && phase === 'idle'
}

function charsRemaining(goal: string): number {
  return Math.max(0, 20 - goal.trim().length)
}

function buildDelegationPayload(goal: string, model: string, budget: number) {
  return {
    title: goal.trim().slice(0, 80),
    contract: {
      goal: goal.trim(),
      riskClass: 'A',
      privacyMode: 'local',
      requiresApproval: false,
      maxBudgetUsd: budget,
      llmModel: model,
      skillCategory: 'infrastructure',
      acceptanceCriteria: ['Tests pass', 'No type errors', 'PR created'],
    },
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('QuickDelegateWidget logic', () => {
  describe('canSubmit', () => {
    it('returns false when goal is empty', () => {
      expect(canSubmit('', 'idle')).toBe(false)
    })

    it('returns false when goal is fewer than 20 chars', () => {
      expect(canSubmit('too short', 'idle')).toBe(false)
    })

    it('returns true when goal is exactly 20 chars', () => {
      expect(canSubmit('12345678901234567890', 'idle')).toBe(true)
    })

    it('returns true when goal is longer than 20 chars', () => {
      expect(canSubmit('Add a feature to the codebase please', 'idle')).toBe(true)
    })

    it('returns false when phase is not idle', () => {
      expect(canSubmit('A goal long enough for validation', 'creating')).toBe(false)
      expect(canSubmit('A goal long enough for validation', 'executing')).toBe(false)
      expect(canSubmit('A goal long enough for validation', 'done')).toBe(false)
    })

    it('trims whitespace before checking length', () => {
      const spaces = '   ' + 'x'.repeat(15) + '   '
      expect(canSubmit(spaces, 'idle')).toBe(false) // 15 < 20
      const padded = '   ' + 'x'.repeat(20) + '   '
      expect(canSubmit(padded, 'idle')).toBe(true)
    })
  })

  describe('charsRemaining', () => {
    it('returns 20 for empty string', () => {
      expect(charsRemaining('')).toBe(20)
    })

    it('returns correct remaining count', () => {
      expect(charsRemaining('hello')).toBe(15)
    })

    it('returns 0 once goal meets minimum', () => {
      expect(charsRemaining('12345678901234567890')).toBe(0)
      expect(charsRemaining('more than twenty chars')).toBe(0)
    })
  })

  describe('buildDelegationPayload', () => {
    it('truncates goal to 80 chars for title', () => {
      const longGoal = 'x'.repeat(100)
      const payload = buildDelegationPayload(longGoal, 'claude-sonnet-4-6', 1)
      expect(payload.title.length).toBe(80)
      expect(payload.contract.goal.length).toBe(100)
    })

    it('sets riskClass A and requiresApproval false', () => {
      const payload = buildDelegationPayload('A valid goal for the agent to work on', 'claude-sonnet-4-6', 2)
      expect(payload.contract.riskClass).toBe('A')
      expect(payload.contract.requiresApproval).toBe(false)
    })

    it('passes through model and budget', () => {
      const payload = buildDelegationPayload('A valid goal for the agent to work on', 'claude-opus-4-7', 5)
      expect(payload.contract.llmModel).toBe('claude-opus-4-7')
      expect(payload.contract.maxBudgetUsd).toBe(5)
    })

    it('includes acceptance criteria', () => {
      const payload = buildDelegationPayload('A valid goal for the agent to work on', 'claude-haiku-4-5', 0.5)
      expect(payload.contract.acceptanceCriteria).toContain('Tests pass')
      expect(payload.contract.acceptanceCriteria).toContain('PR created')
    })
  })
})
