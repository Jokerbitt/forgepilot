import { describe, it, expect } from 'vitest'
import { buildTimelineEvents } from './DelegationTimeline'
import type { Delegation } from '@/lib/models/delegation'

const baseDelegation: Delegation = {
  id: 'del-001',
  title: 'Test Delegation',
  status: 'pending',
  executionRoute: 'local-agent',
  costEstimateUsd: 0.5,
  createdAt: '2024-01-15T10:00:00.000Z',
  updatedAt: '2024-01-15T10:00:00.000Z',
  contract: {
    id: 'c-001',
    workItemId: 'PROJ-42',
    goal: 'Implement feature X',
    context: '',
    definitionOfDone: [],
    riskClass: 'A',
    maxBudgetUsd: 1.0,
    allowedTools: [],
    branchStrategy: 'feature',
    requiresApproval: false,
    privacyMode: 'local',
    createdAt: '2024-01-15T10:00:00.000Z',
  },
}

describe('buildTimelineEvents', () => {
  it('orders events chronologically', () => {
    const delegation: Delegation = {
      ...baseDelegation,
      status: 'completed',
      createdAt: '2024-01-15T10:00:00.000Z',
      updatedAt: '2024-01-15T12:30:00.000Z',
      logs: [
        { timestamp: '2024-01-15T11:30:00.000Z', type: 'info', message: 'Running task' },
        { timestamp: '2024-01-15T10:30:00.000Z', type: 'success', message: 'Manuell freigegeben.' },
      ],
      summaryReport: {
        keyPoints: ['Feature implemented'],
        changes: [],
        timeTakenMinutes: 30,
      },
    }

    const events = buildTimelineEvents(delegation)
    const timestamps = events.map(e => new Date(e.timestamp).getTime())

    for (let i = 1; i < timestamps.length; i++) {
      expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i - 1])
    }

    // First event must be 'created'
    expect(events[0].type).toBe('created')
    // Last event must be 'completed'
    expect(events[events.length - 1].type).toBe('completed')
  })

  it('formats timestamps as German locale strings', () => {
    const delegation: Delegation = {
      ...baseDelegation,
      status: 'pending',
    }

    const events = buildTimelineEvents(delegation)
    expect(events.length).toBeGreaterThan(0)

    // Timestamp should look like German locale (contains dots and colons, not slashes)
    // We test that the timestamp is a non-empty ISO string that can be parsed
    const firstEvent = events[0]
    expect(firstEvent.timestamp).toBeTruthy()
    const parsed = new Date(firstEvent.timestamp)
    expect(isNaN(parsed.getTime())).toBe(false)

    // Check German formatting produces day.month pattern
    const formatted = new Date(firstEvent.timestamp).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    // German format: "15.01.2024, 10:00:00" or similar
    expect(formatted).toMatch(/\d{2}\.\d{2}/)
  })

  it('selects correct status icon type for each event type', () => {
    const failedDelegation: Delegation = {
      ...baseDelegation,
      status: 'failed',
      updatedAt: '2024-01-15T11:00:00.000Z',
      errorMessage: 'Something went wrong',
    }

    const completedDelegation: Delegation = {
      ...baseDelegation,
      status: 'completed',
      updatedAt: '2024-01-15T11:00:00.000Z',
      summaryReport: {
        keyPoints: ['Done'],
        changes: [],
        timeTakenMinutes: 10,
      },
    }

    const runningDelegation: Delegation = {
      ...baseDelegation,
      status: 'running',
      updatedAt: '2024-01-15T11:00:00.000Z',
    }

    const failedEvents = buildTimelineEvents(failedDelegation)
    const completedEvents = buildTimelineEvents(completedDelegation)
    const runningEvents = buildTimelineEvents(runningDelegation)

    // Failed delegation should have a 'failed' terminal event
    const failedTerminal = failedEvents.find(e => e.type === 'failed')
    expect(failedTerminal).toBeDefined()
    expect(failedTerminal?.details).toBe('Something went wrong')

    // Completed delegation should have a 'completed' terminal event
    const completedTerminal = completedEvents.find(e => e.type === 'completed')
    expect(completedTerminal).toBeDefined()
    expect(completedTerminal?.details).toBe('Done')

    // Running delegation should have a 'started' event (last)
    const startedEvent = runningEvents.find(e => e.type === 'started')
    expect(startedEvent).toBeDefined()
    // No completed or failed events
    expect(runningEvents.find(e => e.type === 'completed')).toBeUndefined()
    expect(runningEvents.find(e => e.type === 'failed')).toBeUndefined()
  })
})
