import { describe, it, expect } from 'vitest'
import type { TaskContract } from '@/lib/models/delegation'
import { evaluatePolicy } from './engine'

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

describe('evaluatePolicy', () => {
  it('allows a clean low-risk contract', () => {
    const decision = evaluatePolicy(contract())
    expect(decision.verdict).toBe('allow')
    expect(decision.violations).toHaveLength(0)
    expect(decision.requiresHumanApproval).toBe(false)
    expect(decision.reason).toBe('All policy rules passed.')
  })

  it('denies Risk Class C', () => {
    const decision = evaluatePolicy(contract({ riskClass: 'C' }))
    expect(decision.verdict).toBe('deny')
    expect(decision.violations.some(v => v.ruleId === 'risk-class-c')).toBe(true)
    expect(decision.requiresHumanApproval).toBe(true)
  })

  it('denies tasks with secret tools', () => {
    const decision = evaluatePolicy(contract({ allowedTools: ['Bash', 'read-api-key', 'Read'] }))
    expect(decision.verdict).toBe('deny')
    expect(decision.violations.some(v => v.ruleId === 'secret-tools')).toBe(true)
  })

  it('denies destructive tools', () => {
    const decision = evaluatePolicy(contract({ allowedTools: ['git push --force origin main'] }))
    expect(decision.verdict).toBe('deny')
    expect(decision.violations.some(v => v.ruleId === 'destructive-actions')).toBe(true)
  })

  it('denies when maxBudgetUsd is zero', () => {
    const decision = evaluatePolicy(contract({ maxBudgetUsd: 0 }))
    expect(decision.verdict).toBe('deny')
    expect(decision.violations.some(v => v.ruleId === 'budget')).toBe(true)
  })

  it('denies when goal is empty', () => {
    const decision = evaluatePolicy(contract({ goal: '' }))
    expect(decision.verdict).toBe('deny')
    expect(decision.violations.some(v => v.ruleId === 'goal-required')).toBe(true)
  })

  it('returns review verdict for warnings only', () => {
    const decision = evaluatePolicy(contract({ definitionOfDone: [] }))
    expect(decision.verdict).toBe('review')
    expect(decision.violations.some(v => v.ruleId === 'dod-required')).toBe(true)
    expect(decision.requiresHumanApproval).toBe(true)
  })

  it('denies public privacy mode', () => {
    const decision = evaluatePolicy(contract({ privacyMode: 'public' }))
    expect(decision.verdict).toBe('deny')
    expect(decision.violations.some(v => v.ruleId === 'privacy-public')).toBe(true)
  })

  it('sets requiresHumanApproval when contract.requiresApproval is true', () => {
    const decision = evaluatePolicy(contract({ requiresApproval: true }))
    expect(decision.requiresHumanApproval).toBe(true)
  })

  it('includes reason string with violation messages on deny', () => {
    const decision = evaluatePolicy(contract({ riskClass: 'C' }))
    expect(decision.reason).toContain('Blocked:')
    expect(decision.reason).toContain('Risk Class C')
  })

  it('accumulates multiple blocking violations', () => {
    const decision = evaluatePolicy(contract({
      riskClass: 'C',
      goal: '',
      allowedTools: ['read-credentials'],
    }))
    expect(decision.violations.filter(v => v.severity === 'blocking').length).toBeGreaterThan(1)
  })

  it('accepts custom rules', () => {
    const customRule = {
      id: 'custom',
      description: 'custom test rule',
      evaluate: () => [{ ruleId: 'custom', message: 'custom block', severity: 'blocking' as const }],
    }
    const decision = evaluatePolicy(contract(), [customRule])
    expect(decision.verdict).toBe('deny')
    expect(decision.violations[0].ruleId).toBe('custom')
  })
})
