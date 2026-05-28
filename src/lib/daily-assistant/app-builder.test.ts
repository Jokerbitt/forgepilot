import { describe, expect, it } from 'vitest'
import { buildAppBuilderCapability } from './app-builder'
import type { AutopilotReadinessResponse } from '@/lib/autopilot/readiness'
import type { DailyAssistantInput, DailyAssistantQueueItem } from './next-action'

const readyAutopilot: AutopilotReadinessResponse = {
  status: 'ready',
  score: 100,
  mode: 'claude-cli',
  canStartDemoRun: true,
  canExecuteCode: true,
  canCreatePr: true,
  canAutoMerge: true,
  recommendation: 'Autopilot ist bereit.',
  checks: [
    { id: 'validation-scripts', label: 'Validierung', status: 'ready', detail: 'ok' },
  ],
  checkedAt: '2026-05-28T10:00:00.000Z',
}

const baseAssistant: DailyAssistantInput = {
  pending: 0,
  approved: 1,
  running: 0,
  failed: 0,
  prOpen: 0,
  prMerged: 0,
  authDisabled: false,
  storageMode: 'postgres',
  approvalMode: 'autopilot',
}

const safeQueueItem: DailyAssistantQueueItem = {
  id: 'delegation-1',
  title: 'Build first app slice',
  status: 'approved',
  riskClass: 'A',
  requiresApproval: false,
  updatedAt: '2026-05-28T10:00:00.000Z',
}

describe('buildAppBuilderCapability', () => {
  it('allows larger controlled app builds when runner, PR flow and safe queue are ready', () => {
    const capability = buildAppBuilderCapability({
      assistant: baseAssistant,
      queue: [safeQueueItem],
      autopilot: readyAutopilot,
    })

    expect(capability.level).toBe('large-app-assisted')
    expect(capability.canBuildSmallApp).toBe(true)
    expect(capability.canBuildMultiSliceMvp).toBe(true)
    expect(capability.canRunFullyAutonomous).toBe(true)
    expect(capability.safeNextAction.mode).toBe('execute')
  })

  it('blocks large builds when no real runner is available', () => {
    const capability = buildAppBuilderCapability({
      assistant: baseAssistant,
      queue: [safeQueueItem],
      autopilot: {
        ...readyAutopilot,
        status: 'blocked',
        score: 40,
        mode: 'simulation',
        canStartDemoRun: false,
        canExecuteCode: false,
        canAutoMerge: false,
        recommendation: 'Kein Runner bereit.',
      },
    })

    expect(capability.level).toBe('blocked')
    expect(capability.canBuildSmallApp).toBe(false)
    expect(capability.safeNextAction.mode).toBe('execute')
    expect(capability.gates.find(gate => gate.id === 'runner')?.ready).toBe(false)
  })

  it('prioritizes failed delegation repair over new autonomous app work', () => {
    const capability = buildAppBuilderCapability({
      assistant: { ...baseAssistant, failed: 1 },
      queue: [safeQueueItem],
      autopilot: readyAutopilot,
    })

    expect(capability.level).toBe('blocked')
    expect(capability.safeNextAction.mode).toBe('repair')
    expect(capability.safeNextAction.href).toContain('urgent=true')
  })

  it('sends the user to plan mode when no work is queued yet', () => {
    const capability = buildAppBuilderCapability({
      assistant: { ...baseAssistant, approved: 0 },
      queue: [],
      autopilot: readyAutopilot,
    })

    expect(capability.level).toBe('small-app')
    expect(capability.safeNextAction.mode).toBe('plan')
    expect(capability.safeNextAction.href).toBe('/idea')
  })
})
