import { describe, expect, it } from 'vitest'
import { shouldRequireApproval } from './approval-policy'

describe('approval policy', () => {
  it('requires approval for every task in manual mode', () => {
    expect(shouldRequireApproval({
      approvalMode: 'manual',
      riskClass: 'A',
      scoreTotal: 100,
      autopilotMinScore: 80,
      autopilotMaxRiskClass: 'B',
    })).toBe(true)
  })

  it('auto-approves only class A tasks in balanced mode', () => {
    expect(shouldRequireApproval({
      approvalMode: 'balanced',
      riskClass: 'A',
      scoreTotal: 20,
      autopilotMinScore: 80,
      autopilotMaxRiskClass: 'A',
    })).toBe(false)

    expect(shouldRequireApproval({
      approvalMode: 'balanced',
      riskClass: 'B',
      scoreTotal: 100,
      autopilotMinScore: 80,
      autopilotMaxRiskClass: 'B',
    })).toBe(true)
  })

  it('uses score and max risk class in autopilot mode', () => {
    expect(shouldRequireApproval({
      approvalMode: 'autopilot',
      riskClass: 'B',
      scoreTotal: 90,
      autopilotMinScore: 85,
      autopilotMaxRiskClass: 'B',
    })).toBe(false)

    expect(shouldRequireApproval({
      approvalMode: 'autopilot',
      riskClass: 'C',
      scoreTotal: 95,
      autopilotMinScore: 85,
      autopilotMaxRiskClass: 'B',
    })).toBe(true)

    expect(shouldRequireApproval({
      approvalMode: 'autopilot',
      riskClass: 'A',
      scoreTotal: 70,
      autopilotMinScore: 85,
      autopilotMaxRiskClass: 'A',
    })).toBe(true)
  })
})
