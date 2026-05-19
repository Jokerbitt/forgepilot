import { describe, it, expect } from 'vitest'
import { computeAutopilotScore } from './autopilot-score'
import type { TaskContract } from '@/lib/models/delegation'

const base: TaskContract = {
  id: 'tc-1',
  workItemId: 'wi-1',
  goal: 'Implement the feature correctly and completely',
  context: 'Backend service, TypeScript',
  definitionOfDone: ['Tests green', 'PR created'],
  riskClass: 'A',
  maxBudgetUsd: 5,
  allowedTools: ['Read', 'Write', 'Edit'],
  branchStrategy: 'feature',
  requiresApproval: false,
  privacyMode: 'local',
  createdAt: new Date().toISOString(),
}

describe('computeAutopilotScore', () => {
  it('returns score 100 and green for a perfect contract', () => {
    const result = computeAutopilotScore(base)
    expect(result.score).toBe(100)
    expect(result.level).toBe('green')
    expect(result.canAutopilot).toBe(true)
    expect(result.reasons).toHaveLength(0)
  })

  it('deducts heavily for Risk Class C and blocks autopilot', () => {
    const result = computeAutopilotScore({ ...base, riskClass: 'C' })
    expect(result.score).toBeLessThanOrEqual(40)
    expect(result.level).toBe('red')
    expect(result.canAutopilot).toBe(false)
    expect(result.reasons.some(r => r.includes('Risk Class C'))).toBe(true)
  })

  it('deducts for Risk Class B but may still allow supervised run', () => {
    const result = computeAutopilotScore({ ...base, riskClass: 'B' })
    expect(result.score).toBe(75)
    expect(result.level).toBe('amber')
  })

  it('deducts for requiresApproval', () => {
    const result = computeAutopilotScore({ ...base, requiresApproval: true })
    expect(result.score).toBe(80)
    expect(result.reasons.some(r => r.includes('Freigabe'))).toBe(true)
  })

  it('deducts for public privacy mode', () => {
    const result = computeAutopilotScore({ ...base, privacyMode: 'public' })
    expect(result.score).toBe(75)
    expect(result.reasons.some(r => r.includes('öffentlich'))).toBe(true)
  })

  it('deducts for missing definitionOfDone', () => {
    const result = computeAutopilotScore({ ...base, definitionOfDone: [] })
    expect(result.score).toBe(90)
  })

  it('deducts for very high budget', () => {
    const result = computeAutopilotScore({ ...base, maxBudgetUsd: 100 })
    expect(result.score).toBe(90)
    expect(result.reasons.some(r => r.includes('Budget sehr hoch'))).toBe(true)
  })

  it('accumulates multiple deductions correctly', () => {
    const result = computeAutopilotScore({
      ...base,
      riskClass: 'B',
      requiresApproval: true,
      privacyMode: 'private-cloud',
      definitionOfDone: [],
    })
    // B(-25) + requiresApproval(-20) + private-cloud(-10) + no DoD(-10) = -65
    expect(result.score).toBe(35)
    expect(result.level).toBe('red')
    expect(result.canAutopilot).toBe(false)
  })
})
