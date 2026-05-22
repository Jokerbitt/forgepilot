import { describe, it, expect } from 'vitest'
import { getGuidance } from './DelegationNextActionPanel'
import type { Delegation } from '@/lib/models/delegation'

function makeDelegation(overrides: Partial<Delegation>): Delegation {
  return {
    id: 'test-id',
    title: 'Test',
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    contract: {
      id: 'tc-1',
      createdAt: new Date().toISOString(),
      workItemId: 'WI-1',
      goal: 'Test goal',
      context: '',
      riskClass: 'A',
      requiresApproval: false,
      branchStrategy: 'feature',
      privacyMode: 'local',
      maxBudgetUsd: 1.0,
      definitionOfDone: [],
      allowedTools: [],
    },
    logs: [],
    ...overrides,
  } as Delegation
}

const noProps = {}

describe('getGuidance', () => {
  it('pending + requiresApproval Risk A → approve guidance', () => {
    const d = makeDelegation({ status: 'pending', contract: { id: 'tc-1', createdAt: new Date().toISOString(), workItemId: 'WI-1', goal: 'g', context: '', riskClass: 'A', requiresApproval: true, branchStrategy: 'feature', privacyMode: 'local', maxBudgetUsd: 1, definitionOfDone: [], allowedTools: [] } })
    const g = getGuidance(d, noProps)
    expect(g?.title).toContain('Freigabe')
    expect(g?.actions.some(a => a.label.includes('Freigeben'))).toBe(true)
  })

  it('pending + requiresApproval Risk C → locked message, no action buttons', () => {
    const d = makeDelegation({ status: 'pending', contract: { id: 'tc-1', createdAt: new Date().toISOString(), workItemId: 'WI-1', goal: 'g', context: '', riskClass: 'C', requiresApproval: true, branchStrategy: 'feature', privacyMode: 'local', maxBudgetUsd: 1, definitionOfDone: [], allowedTools: [] } })
    const g = getGuidance(d, noProps)
    expect(g?.title).toContain('Risk C')
    expect(g?.actions).toHaveLength(0)
  })

  it('pending + no requiresApproval → start guidance', () => {
    const d = makeDelegation({ status: 'pending' })
    const g = getGuidance(d, noProps)
    expect(g?.title).toContain('Starten')
  })

  it('approved → start action', () => {
    const d = makeDelegation({ status: 'approved' })
    const g = getGuidance(d, noProps)
    expect(g?.actions.some(a => a.label.includes('Starten'))).toBe(true)
  })

  it('running → active message, no actions', () => {
    const d = makeDelegation({ status: 'running' })
    const g = getGuidance(d, noProps)
    expect(g?.title).toContain('aktiv')
    expect(g?.actions).toHaveLength(0)
  })

  it('failed → retry + escalate actions', () => {
    const d = makeDelegation({ status: 'failed' })
    const g = getGuidance(d, noProps)
    expect(g?.actions.some(a => a.label.includes('Wiederholen'))).toBe(true)
    expect(g?.actions.some(a => a.label.includes('bestem Modell'))).toBe(true)
  })

  it('failed with NoAIProvider error → settings link instead of escalate', () => {
    const d = makeDelegation({
      status: 'failed',
      logs: [{ timestamp: new Date().toISOString(), type: 'error', message: 'NoAIProvider: no AI provider configured' }],
    })
    const g = getGuidance(d, noProps)
    expect(g?.body).toContain('Provider')
    expect(g?.actions.some(a => a.href === '/settings')).toBe(true)
  })

  it('completed without PR → PR creation action', () => {
    const d = makeDelegation({ status: 'completed' })
    const g = getGuidance(d, noProps)
    expect(g?.actions.some(a => a.label.includes('PR erstellen'))).toBe(true)
  })

  it('completed with PR + critic approved → merge action', () => {
    const d = makeDelegation({
      status: 'completed',
      summaryReport: { keyPoints: [], changes: [], timeTakenMinutes: 1, prUrl: 'https://github.com/x/y/pull/1' },
      criticScore: { verdict: 'approved', correctness: 90, efficiency: 85, drift: 80, summary: '', runAt: new Date().toISOString() },
    })
    const g = getGuidance(d, noProps)
    expect(g?.title).toContain('Vollständig')
    expect(g?.actions.some(a => a.label.includes('mergen'))).toBe(true)
  })

  it('completed with PR + critic needs-revision → retry action', () => {
    const d = makeDelegation({
      status: 'completed',
      summaryReport: { keyPoints: [], changes: [], timeTakenMinutes: 1, prUrl: 'https://github.com/x/y/pull/1' },
      criticScore: { verdict: 'needs-revision', correctness: 60, efficiency: 55, drift: 50, summary: '', runAt: new Date().toISOString() },
    })
    const g = getGuidance(d, noProps)
    expect(g?.title).toContain('Revision')
    expect(g?.actions.some(a => a.label.includes('Neu ausführen'))).toBe(true)
  })

  it('cancelled → retry action', () => {
    const d = makeDelegation({ status: 'cancelled' })
    const g = getGuidance(d, noProps)
    expect(g?.actions.some(a => a.label.includes('Wiederholen'))).toBe(true)
  })
})
