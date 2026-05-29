import { describe, expect, it } from 'vitest'
import { buildAssistantRoadmap } from './roadmap'
import type { AutopilotReadinessResponse } from '@/lib/autopilot/readiness'
import type { AppBuilderCapability } from './app-builder'
import type { DailyAssistantInput, DailyAssistantQueueItem } from './next-action'

const readyAutopilot: AutopilotReadinessResponse = {
  status: 'ready',
  score: 95,
  mode: 'claude-cli',
  canStartDemoRun: true,
  canExecuteCode: true,
  canCreatePr: true,
  canAutoMerge: true,
  recommendation: 'Bereit.',
  checkedAt: '2026-05-29T08:00:00.000Z',
  checks: [
    { id: 'validation-scripts', label: 'Validation', status: 'ready', detail: 'ok' },
  ],
}

const baseAssistant: DailyAssistantInput = {
  pending: 0,
  approved: 1,
  running: 0,
  failed: 0,
  prOpen: 0,
  prMerged: 1,
  authDisabled: false,
  storageMode: 'postgres',
  approvalMode: 'autopilot',
}

const safeQueue: DailyAssistantQueueItem[] = [{
  id: 'delegation-1',
  title: 'Build slice',
  status: 'approved',
  riskClass: 'A',
  requiresApproval: false,
  updatedAt: '2026-05-29T08:00:00.000Z',
}]

const appBuilder: AppBuilderCapability = {
  level: 'large-app-assisted',
  score: 95,
  title: 'Bereit',
  summary: 'ok',
  canBuildSmallApp: true,
  canBuildMultiSliceMvp: true,
  canRunFullyAutonomous: true,
  safeNextAction: { label: 'Nächsten sicheren Slice starten', href: '/delegations', mode: 'execute' },
  gates: [],
  workflow: [],
}

describe('buildAssistantRoadmap', () => {
  it('prioritizes reliable execute loop when everything is ready', () => {
    const roadmap = buildAssistantRoadmap({
      assistant: baseAssistant,
      queue: safeQueue,
      autopilot: readyAutopilot,
      appBuilder,
    })

    expect(roadmap.milestones).toHaveLength(6)
    expect(roadmap.milestones[0].id).toBe('m4-reliable-execute-loop')
    expect(roadmap.milestones[0].progress).toBe(100)
    expect(roadmap.nextAutonomousStep.href).toBe('/live')
  })

  it('blocks on failed delegations before scaling autonomy', () => {
    const roadmap = buildAssistantRoadmap({
      assistant: { ...baseAssistant, failed: 2 },
      queue: safeQueue,
      autopilot: readyAutopilot,
      appBuilder: { ...appBuilder, level: 'blocked', canBuildSmallApp: false, canBuildMultiSliceMvp: false, canRunFullyAutonomous: false },
    })

    const executeLoop = roadmap.milestones.find(m => m.id === 'm4-reliable-execute-loop')
    expect(executeLoop?.status).toBe('blocked')
    expect(roadmap.focusMilestoneId).toBe('m4-reliable-execute-loop')
    expect(roadmap.nextAutonomousStep.href).toContain('urgent=true')
  })

  it('points to runner setup when no real runner is available', () => {
    const roadmap = buildAssistantRoadmap({
      assistant: baseAssistant,
      queue: safeQueue,
      autopilot: {
        ...readyAutopilot,
        status: 'blocked',
        score: 35,
        mode: 'simulation',
        canStartDemoRun: false,
        canExecuteCode: false,
        canCreatePr: false,
        canAutoMerge: false,
      },
      appBuilder: { ...appBuilder, level: 'blocked', score: 35, canBuildSmallApp: false, canBuildMultiSliceMvp: false, canRunFullyAutonomous: false },
    })

    expect(roadmap.focusMilestoneId).toBe('m4-reliable-execute-loop')
    expect(roadmap.nextAutonomousStep.label).toBe('Runner einrichten')
    expect(roadmap.nextAutonomousStep.mode).toBe('configure')
  })
})
