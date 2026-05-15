import { describe, it, expect } from 'vitest'
import type { NBAScore, NBARecommendation, SuggestedAction } from './nba'
import type { WorkItem } from './work-item'

describe('NBAScore type', () => {
  it('accepts a valid NBAScore with 0-25 range per dimension', () => {
    const score: NBAScore = {
      urgency: 25,
      impact: 20,
      delegability: 15,
      readiness: 10,
      total: 70,
    }
    expect(score.total).toBe(70)
    expect(score.urgency + score.impact + score.delegability + score.readiness).toBe(score.total)
  })

  it('max total is 100', () => {
    const maxScore: NBAScore = {
      urgency: 25,
      impact: 25,
      delegability: 25,
      readiness: 25,
      total: 100,
    }
    expect(maxScore.total).toBe(100)
  })
})

describe('NBARecommendation type', () => {
  it('accepts a valid recommendation', () => {
    const workItem: WorkItem = {
      id: 'lin-1',
      source: 'linear',
      type: 'ticket',
      title: 'Implement NBA scoring',
      url: 'https://linear.app/issue/JOK-5',
      projectId: 'proj-1',
      status: 'todo',
      priority: 1,
      blocked: false,
      risk: 'A',
      aiDelegable: true,
      updatedAt: '2026-05-15T10:00:00Z',
      createdAt: '2026-05-15T09:00:00Z',
    }

    const rec: NBARecommendation = {
      workItem,
      score: { urgency: 20, impact: 25, delegability: 25, readiness: 25, total: 95 },
      suggestedAction: 'delegate-runner',
      executionRoute: 'runner',
      riskClass: 'A',
      estimatedCostUsd: 1.5,
      rationale: 'High impact, fully delegable, not blocked',
      risks: [],
    }
    expect(rec.suggestedAction).toBe('delegate-runner')
    expect(rec.score.total).toBe(95)
  })

  it('covers all SuggestedAction values', () => {
    const actions: SuggestedAction[] = ['do-now', 'delegate-ai', 'delegate-runner', 'research', 'wait', 'blocked']
    expect(actions).toHaveLength(6)
  })
})
