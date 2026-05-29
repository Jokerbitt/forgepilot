import { describe, expect, it } from 'vitest'
import { buildQueueHygieneSummary } from './queue-hygiene'
import type { DailyAssistantQueueItem } from './next-action'

function item(overrides: Partial<DailyAssistantQueueItem>): DailyAssistantQueueItem {
  return {
    id: 'item',
    title: 'Useful task',
    status: 'approved',
    riskClass: 'A',
    updatedAt: '2026-05-29T08:00:00.000Z',
    ...overrides,
  }
}

describe('buildQueueHygieneSummary', () => {
  it('collapses duplicate titles and keeps one representative visible', () => {
    const summary = buildQueueHygieneSummary([
      item({ id: 'a', title: 'Build auth module' }),
      item({ id: 'b', title: 'Build auth module', updatedAt: '2026-05-29T07:00:00.000Z' }),
      item({ id: 'c', title: 'Improve Live View' }),
    ])

    expect(summary.visibleItems.map(entry => entry.id)).toEqual(['a', 'c'])
    expect(summary.hiddenDuplicateCount).toBe(1)
    expect(summary.duplicateGroups[0]).toMatchObject({
      title: 'Build auth module',
      count: 2,
      representativeId: 'a',
      hiddenCount: 1,
      hiddenIds: ['b'],
    })
  })

  it('hides noisy generated test items after the first useful entry', () => {
    const summary = buildQueueHygieneSummary([
      item({ id: 'useful', title: 'Repair failed PR checks' }),
      item({ id: 'test-1', title: 'M2 Status Transition Test' }),
      item({ id: 'test-2', title: 'ForgePilot E2E Test Feature' }),
    ])

    expect(summary.visibleItems.map(entry => entry.id)).toEqual(['useful'])
    expect(summary.noisyTestCount).toBe(2)
    expect(summary.recommendation).toContain('verdichtet')
  })

  it('counts risk-c work without promoting it to autonomous work', () => {
    const summary = buildQueueHygieneSummary([
      item({ id: 'safe', title: 'Safe task', riskClass: 'A' }),
      item({ id: 'risky', title: 'Production migration', riskClass: 'C' }),
    ])

    expect(summary.riskCCount).toBe(1)
    expect(summary.visibleItems.map(entry => entry.id)).toEqual(['safe', 'risky'])
  })
})
