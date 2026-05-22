import { describe, it, expect } from 'vitest'
import { formatLogsAsText } from './log-export'
import type { Delegation } from '@/lib/models/delegation'

function makeDelegation(overrides: Partial<Delegation> = {}): Delegation {
  return {
    id: 'del-abc12345',
    title: 'Add auth middleware',
    status: 'failed',
    executionRoute: 'local-agent',
    costEstimateUsd: 0.5,
    contract: {
      id: 'tc-1',
      workItemId: 'WI-1',
      goal: 'Implement auth middleware for API routes',
      context: '',
      definitionOfDone: [],
      riskClass: 'A',
      maxBudgetUsd: 2,
      allowedTools: [],
      branchStrategy: 'feature',
      requiresApproval: false,
      privacyMode: 'local',
      createdAt: '2026-05-22T09:00:00.000Z',
    },
    createdAt: '2026-05-22T09:00:00.000Z',
    updatedAt: '2026-05-22T09:05:00.000Z',
    ...overrides,
  }
}

describe('formatLogsAsText', () => {
  it('includes delegation title and id in header', () => {
    const output = formatLogsAsText(makeDelegation())
    expect(output).toContain('Add auth middleware')
    expect(output).toContain('del-abc12345')
  })

  it('includes the goal in header', () => {
    const output = formatLogsAsText(makeDelegation())
    expect(output).toContain('Implement auth middleware for API routes')
  })

  it('returns placeholder when no logs', () => {
    const output = formatLogsAsText(makeDelegation({ logs: [] }))
    expect(output).toContain('Keine Logs vorhanden')
  })

  it('returns placeholder when logs is undefined', () => {
    const output = formatLogsAsText(makeDelegation({ logs: undefined }))
    expect(output).toContain('Keine Logs vorhanden')
  })

  it('formats info log with [INFO] prefix', () => {
    const output = formatLogsAsText(makeDelegation({
      logs: [{ timestamp: '2026-05-22T09:01:00.000Z', type: 'info', message: 'Starting execution' }],
    }))
    expect(output).toContain('[INFO]')
    expect(output).toContain('Starting execution')
  })

  it('formats error log with [ERROR] prefix', () => {
    const output = formatLogsAsText(makeDelegation({
      logs: [{ timestamp: '2026-05-22T09:01:00.000Z', type: 'error', message: 'TypeScript error TS2345' }],
    }))
    expect(output).toContain('[ERROR]')
    expect(output).toContain('TypeScript error TS2345')
  })

  it('formats success log with [OK] prefix', () => {
    const output = formatLogsAsText(makeDelegation({
      logs: [{ timestamp: '2026-05-22T09:01:00.000Z', type: 'success', message: 'Done' }],
    }))
    expect(output).toContain('[OK]')
    expect(output).toContain('Done')
  })

  it('includes all log entries', () => {
    const output = formatLogsAsText(makeDelegation({
      logs: [
        { timestamp: '2026-05-22T09:01:00.000Z', type: 'info', message: 'Step 1' },
        { timestamp: '2026-05-22T09:02:00.000Z', type: 'info', message: 'Step 2' },
        { timestamp: '2026-05-22T09:03:00.000Z', type: 'error', message: 'Step 3 failed' },
      ],
    }))
    expect(output).toContain('Step 1')
    expect(output).toContain('Step 2')
    expect(output).toContain('Step 3 failed')
  })
})
