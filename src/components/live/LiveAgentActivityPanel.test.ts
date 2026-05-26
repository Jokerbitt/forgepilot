import { describe, expect, it } from 'vitest'
import type { AgentLog, Delegation } from '@/lib/models/delegation'
import {
  getProductionPhases,
  getRecommendedAction,
  lastLogs,
  sortLiveDelegations,
  summarizeLiveActivity,
} from './LiveAgentActivityPanel'

function makeDelegation(overrides: Partial<Delegation>): Delegation {
  return {
    id: overrides.id ?? 'd-1',
    title: overrides.title ?? 'Test delegation',
    status: overrides.status ?? 'approved',
    executionRoute: overrides.executionRoute ?? 'runner',
    costEstimateUsd: 0,
    createdAt: overrides.createdAt ?? '2026-05-26T08:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-05-26T08:00:00.000Z',
    contract: {
      id: 'c-1',
      workItemId: 'w-1',
      goal: 'Build a useful thing',
      context: 'test',
      definitionOfDone: ['done'],
      riskClass: 'A',
      maxBudgetUsd: 0,
      allowedTools: [],
      branchStrategy: 'feature',
      requiresApproval: false,
      privacyMode: 'local',
      createdAt: '2026-05-26T08:00:00.000Z',
    },
    ...overrides,
  }
}

function makeLog(message: string): AgentLog {
  return {
    timestamp: '2026-05-26T08:00:00.000Z',
    type: 'info',
    message,
  }
}

function phaseDoneMap(delegation: Delegation): Record<string, boolean> {
  return Object.fromEntries(getProductionPhases(delegation).map(phase => [phase.id, phase.done]))
}

describe('sortLiveDelegations', () => {
  it('puts running and ready work before completed work', () => {
    const sorted = sortLiveDelegations([
      makeDelegation({ id: 'done', status: 'completed' }),
      makeDelegation({ id: 'ready', status: 'approved' }),
      makeDelegation({ id: 'run', status: 'running' }),
    ])

    expect(sorted.map(d => d.id)).toEqual(['run', 'ready', 'done'])
  })

  it('sorts equal statuses by latest update first', () => {
    const sorted = sortLiveDelegations([
      makeDelegation({ id: 'old', status: 'approved', updatedAt: '2026-05-26T08:00:00.000Z' }),
      makeDelegation({ id: 'new', status: 'approved', updatedAt: '2026-05-26T09:00:00.000Z' }),
    ])

    expect(sorted.map(d => d.id)).toEqual(['new', 'old'])
  })
})

describe('summarizeLiveActivity', () => {
  it('counts live activity by operational status', () => {
    const summary = summarizeLiveActivity([
      makeDelegation({ status: 'running' }),
      makeDelegation({ status: 'approved' }),
      makeDelegation({ status: 'completed' }),
      makeDelegation({ status: 'failed' }),
      makeDelegation({ status: 'pending' }),
    ])

    expect(summary).toEqual({
      total: 5,
      running: 1,
      ready: 1,
      completed: 1,
      failed: 1,
    })
  })
})

describe('lastLogs', () => {
  it('returns an empty array without logs', () => {
    expect(lastLogs(undefined)).toEqual([])
    expect(lastLogs([])).toEqual([])
  })

  it('returns the last three logs by default', () => {
    const logs = [makeLog('one'), makeLog('two'), makeLog('three'), makeLog('four')]
    expect(lastLogs(logs).map(log => log.message)).toEqual(['two', 'three', 'four'])
  })
})

describe('getProductionPhases', () => {
  it('marks workspace, code, validation and PR when evidence exists', () => {
    const phases = phaseDoneMap(makeDelegation({
      status: 'completed',
      startedAt: '2026-05-26T08:00:00.000Z',
      logs: [
        makeLog('Runner-Workspace vorbereitet: /tmp/worktree/d-1'),
        makeLog('Claude Code Max/OAuth hat im isolierten Worktree Code committed'),
        makeLog('Validierung gruen: filter-utils tests (10), type-check, lint.'),
      ],
      summaryReport: {
        keyPoints: ['done'],
        changes: ['src/app/work-items/page.tsx'],
        filesAdded: ['src/lib/work-items/filter-utils.ts'],
        timeTakenMinutes: 8,
        testsPassed: 10,
        prUrl: 'https://github.com/Jokerbitt/forgepilot/pull/576',
      },
    }))

    expect(phases).toMatchObject({
      prepared: true,
      workspace: true,
      coding: true,
      validated: true,
      pr: true,
    })
  })

  it('does not mark code as done for completed runs without changed files', () => {
    const phases = phaseDoneMap(makeDelegation({
      status: 'completed',
      summaryReport: {
        keyPoints: ['model only summarized'],
        changes: [],
        timeTakenMinutes: 1,
      },
    }))

    expect(phases.coding).toBe(false)
  })
})

describe('getRecommendedAction', () => {
  it('warns against merging when no code change is known', () => {
    expect(getRecommendedAction(makeDelegation({ status: 'completed' }))).toContain('keine Codeaenderung')
  })

  it('recommends PR review after code, validation and PR exist', () => {
    const action = getRecommendedAction(makeDelegation({
      status: 'completed',
      logs: [makeLog('Validierung gruen: tests, type-check, lint')],
      summaryReport: {
        keyPoints: ['done'],
        changes: ['src/app/work-items/page.tsx'],
        timeTakenMinutes: 1,
        testsPassed: 10,
        prUrl: 'https://github.com/Jokerbitt/forgepilot/pull/576',
      },
    }))

    expect(action).toContain('PR pruefen')
  })
})
