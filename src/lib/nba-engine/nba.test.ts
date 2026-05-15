import { describe, it, expect } from 'vitest'
import { calculateScore } from './scorer'
import { prioritizeItems } from './prioritizer'
import type { WorkItem } from '../models/work-item'

const mockItem: WorkItem = {
  id: 'JOK-1',
  source: 'linear',
  type: 'ticket',
  title: 'Test',
  url: 'https://linear.app/jokerbitt/issue/JOK-1',
  projectId: 'proj-1',
  status: 'todo',
  priority: 2,
  blocked: false,
  risk: 'B',
  aiDelegable: true,
  updatedAt: new Date().toISOString(),
  createdAt: new Date().toISOString()
}

describe('scorer', () => {
  it('calculates score correctly for typical item', () => {
    const score = calculateScore(mockItem)
    expect(score.urgency).toBe(15) // Priority 2
    expect(score.impact).toBe(25) // ticket
    expect(score.delegability).toBe(15) // aiDelegable + risk B
    expect(score.readiness).toBe(25) // not blocked
    expect(score.total).toBe(80)
  })

  it('sets readiness to 0 if blocked', () => {
    const score = calculateScore({ ...mockItem, blocked: true })
    expect(score.readiness).toBe(0)
    expect(score.total).toBe(55)
  })
})

describe('prioritizer', () => {
  it('prioritizes delegable high score items to AI', () => {
    const recs = prioritizeItems([mockItem])
    expect(recs[0].suggestedAction).toBe('delegate-ai')
    expect(recs[0].executionRoute).toBe('local-agent')
  })

  it('downgrades Risk C to manual execution', () => {
    const recs = prioritizeItems([{ ...mockItem, risk: 'C' }])
    expect(recs[0].suggestedAction).toBe('do-now')
    expect(recs[0].executionRoute).toBe('manual')
    expect(recs[0].risks).toContain('High risk operation (Class C)')
  })
  
  it('marks blocked items correctly', () => {
    const recs = prioritizeItems([{ ...mockItem, blocked: true }])
    expect(recs[0].suggestedAction).toBe('blocked')
  })
})
