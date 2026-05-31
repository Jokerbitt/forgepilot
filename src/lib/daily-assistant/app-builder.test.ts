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
      projectPipeline: {
        projectCount: 1,
        workPackageCount: 4,
        safeSliceCount: 1,
        blockedByDependencyCount: 0,
        inFlightSliceCount: 0,
        completedSliceCount: 0,
        recommendation: 'Naechster sicherer App-Slice: Build first app slice.',
        nextCandidate: null,
      },
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
      queue: [{ ...safeQueueItem, id: 'failed-1', status: 'failed', title: 'Budget stopped PR' }],
      autopilot: readyAutopilot,
    })

    expect(capability.level).toBe('blocked')
    expect(capability.safeNextAction.mode).toBe('repair')
    expect(capability.safeNextAction.href).toBe('/delegations/failed-1')
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

  it('uses safe project slices for multi-slice MVP readiness even before delegations exist', () => {
    const capability = buildAppBuilderCapability({
      assistant: { ...baseAssistant, approved: 0 },
      queue: [],
      autopilot: readyAutopilot,
      projectPipeline: {
        projectCount: 1,
        workPackageCount: 5,
        safeSliceCount: 2,
        blockedByDependencyCount: 1,
        inFlightSliceCount: 0,
        completedSliceCount: 0,
        recommendation: 'Naechster sicherer App-Slice: Foundation.',
        nextCandidate: {
          id: 'wp-1',
          projectId: 'brief-1',
          projectTitle: 'TaskFlow',
          title: 'Foundation',
          riskClass: 'A',
          priority: 'critical',
          status: 'ready',
          href: '/projects/brief-1',
          reason: 'Kleiner sicherer Start-Slice ohne offene Abhaengigkeiten.',
        },
      },
    })

    expect(capability.canBuildMultiSliceMvp).toBe(true)
    expect(capability.safeNextAction.label).toBe('Projekt-Slice vorbereiten')
    expect(capability.safeNextAction.href).toBe('/projects/brief-1')
    expect(capability.gates.find(gate => gate.id === 'project-pipeline')?.ready).toBe(true)
  })
})
