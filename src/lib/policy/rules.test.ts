import { describe, it, expect } from 'vitest'
import {
  riskClassCRule,
  secretToolRule,
  destructiveActionRule,
  budgetRule,
  goalRequiredRule,
  definitionOfDoneRule,
  publicPrivacyRule,
  DEFAULT_RULES,
} from './rules'
import type { TaskContract } from '@/lib/models/delegation'

function makeContract(overrides: Partial<TaskContract> = {}): TaskContract {
  return {
    id: 'c-1',
    workItemId: 'W-1',
    goal: 'Build the main screen',
    context: '',
    definitionOfDone: ['Tests pass'],
    riskClass: 'A',
    maxBudgetUsd: 1,
    allowedTools: ['bash', 'read_file'],
    branchStrategy: 'feature',
    requiresApproval: false,
    privacyMode: 'local',
    createdAt: new Date().toISOString(),
    ...overrides,
  } as TaskContract
}

describe('riskClassCRule', () => {
  it('returns blocking violation for Risk Class C', () => {
    const violations = riskClassCRule.evaluate(makeContract({ riskClass: 'C' }))
    expect(violations).toHaveLength(1)
    expect(violations[0].severity).toBe('blocking')
    expect(violations[0].ruleId).toBe('risk-class-c')
  })

  it('returns no violations for Risk Class A or B', () => {
    expect(riskClassCRule.evaluate(makeContract({ riskClass: 'A' }))).toHaveLength(0)
    expect(riskClassCRule.evaluate(makeContract({ riskClass: 'B' }))).toHaveLength(0)
  })
})

describe('secretToolRule', () => {
  it('blocks tools matching secret patterns', () => {
    const violations = secretToolRule.evaluate(makeContract({ allowedTools: ['read_secret', 'bash'] }))
    expect(violations).toHaveLength(1)
    expect(violations[0].severity).toBe('blocking')
  })

  it('blocks credential patterns', () => {
    expect(secretToolRule.evaluate(makeContract({ allowedTools: ['get_credentials'] }))).toHaveLength(1)
  })

  it('blocks .env access', () => {
    expect(secretToolRule.evaluate(makeContract({ allowedTools: ['read .env file'] }))).toHaveLength(1)
  })

  it('allows safe tools', () => {
    expect(secretToolRule.evaluate(makeContract({ allowedTools: ['bash', 'read_file', 'write_file'] }))).toHaveLength(0)
  })

  it('does not crash when allowedTools is missing (persisted contract without it)', () => {
    const contract = makeContract({ allowedTools: undefined as unknown as string[] })
    expect(() => secretToolRule.evaluate(contract)).not.toThrow()
    expect(secretToolRule.evaluate(contract)).toHaveLength(0)
  })
})

describe('destructiveActionRule', () => {
  it('blocks rm -rf', () => {
    const violations = destructiveActionRule.evaluate(makeContract({ allowedTools: ['rm -rf /tmp'] }))
    expect(violations).toHaveLength(1)
    expect(violations[0].severity).toBe('blocking')
  })

  it('blocks git push --force', () => {
    expect(destructiveActionRule.evaluate(makeContract({ allowedTools: ['git push --force origin main'] }))).toHaveLength(1)
  })

  it('blocks DROP TABLE', () => {
    expect(destructiveActionRule.evaluate(makeContract({ allowedTools: ['DROP TABLE users'] }))).toHaveLength(1)
  })

  it('allows safe tools', () => {
    expect(destructiveActionRule.evaluate(makeContract({ allowedTools: ['git commit', 'npm test'] }))).toHaveLength(0)
  })

  it('does not crash when allowedTools is missing (persisted contract without it)', () => {
    const contract = makeContract({ allowedTools: undefined as unknown as string[] })
    expect(() => destructiveActionRule.evaluate(contract)).not.toThrow()
    expect(destructiveActionRule.evaluate(contract)).toHaveLength(0)
  })
})

describe('budgetRule', () => {
  it('blocks zero budget', () => {
    const violations = budgetRule.evaluate(makeContract({ maxBudgetUsd: 0 }))
    expect(violations).toHaveLength(1)
    expect(violations[0].severity).toBe('blocking')
  })

  it('blocks negative budget', () => {
    expect(budgetRule.evaluate(makeContract({ maxBudgetUsd: -1 }))).toHaveLength(1)
  })

  it('allows positive budget', () => {
    expect(budgetRule.evaluate(makeContract({ maxBudgetUsd: 0.01 }))).toHaveLength(0)
    expect(budgetRule.evaluate(makeContract({ maxBudgetUsd: 5 }))).toHaveLength(0)
  })
})

describe('goalRequiredRule', () => {
  it('blocks empty goal', () => {
    expect(goalRequiredRule.evaluate(makeContract({ goal: '' }))).toHaveLength(1)
  })

  it('blocks whitespace-only goal', () => {
    expect(goalRequiredRule.evaluate(makeContract({ goal: '   ' }))).toHaveLength(1)
  })

  it('allows non-empty goal', () => {
    expect(goalRequiredRule.evaluate(makeContract({ goal: 'Build something' }))).toHaveLength(0)
  })
})

describe('definitionOfDoneRule', () => {
  it('returns warning when DoD is empty', () => {
    const violations = definitionOfDoneRule.evaluate(makeContract({ definitionOfDone: [] }))
    expect(violations).toHaveLength(1)
    expect(violations[0].severity).toBe('warning')
  })

  it('returns no violations when DoD has items', () => {
    expect(definitionOfDoneRule.evaluate(makeContract({ definitionOfDone: ['Tests pass'] }))).toHaveLength(0)
  })
})

describe('publicPrivacyRule', () => {
  it('blocks public privacy mode', () => {
    const violations = publicPrivacyRule.evaluate(makeContract({ privacyMode: 'public' }))
    expect(violations).toHaveLength(1)
    expect(violations[0].severity).toBe('blocking')
  })

  it('allows local and private-cloud modes', () => {
    expect(publicPrivacyRule.evaluate(makeContract({ privacyMode: 'local' }))).toHaveLength(0)
    expect(publicPrivacyRule.evaluate(makeContract({ privacyMode: 'private-cloud' }))).toHaveLength(0)
  })
})

describe('DEFAULT_RULES', () => {
  it('contains all 7 policy rules', () => {
    expect(DEFAULT_RULES).toHaveLength(7)
  })

  it('all rules have an id, description, and evaluate function', () => {
    for (const rule of DEFAULT_RULES) {
      expect(typeof rule.id).toBe('string')
      expect(typeof rule.description).toBe('string')
      expect(typeof rule.evaluate).toBe('function')
    }
  })

  it('clean contract passes all rules without blocking violations', () => {
    const contract = makeContract()
    const allViolations = DEFAULT_RULES.flatMap(r => r.evaluate(contract))
    const blocking = allViolations.filter(v => v.severity === 'blocking')
    expect(blocking).toHaveLength(0)
  })
})
