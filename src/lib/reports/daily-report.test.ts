import { describe, expect, it } from 'vitest'
import type { AttentionItem } from '@/lib/models/attention'
import type { Delegation } from '@/lib/models/delegation'
import type { ProjectBrief } from '@/lib/models/project-brief'
import type { MemoryCard } from '@/lib/knowledge/types'
import { buildDailyReport, renderDailyReportMarkdown } from './daily-report'

const now = new Date('2026-05-21T12:00:00.000Z')

function delegation(overrides: Partial<Delegation>): Delegation {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    title: 'Test delegation',
    status: 'completed',
    executionRoute: 'runner',
    costEstimateUsd: 1,
    createdAt: '2026-05-21T10:00:00.000Z',
    updatedAt: '2026-05-21T11:00:00.000Z',
    contract: {
      id: 'contract-1',
      workItemId: 'JOK-1',
      goal: 'Ship the core flow',
      context: '',
      definitionOfDone: ['Tests pass'],
      riskClass: 'B',
      maxBudgetUsd: 2,
      allowedTools: ['read', 'write'],
      branchStrategy: 'feature',
      requiresApproval: false,
      privacyMode: 'private-cloud',
      createdAt: '2026-05-21T10:00:00.000Z',
    },
    ...overrides,
  }
}

function brief(overrides: Partial<ProjectBrief>): ProjectBrief {
  return {
    id: 'brief-1',
    title: 'ForgePilot V1',
    status: 'accepted',
    createdAt: '2026-05-21T09:00:00.000Z',
    updatedAt: '2026-05-21T09:30:00.000Z',
    rawIdea: 'Build a focused AI workflow tool.',
    problemStatement: 'Agent work is chaotic.',
    targetAudience: 'Solo developers',
    desiredOutcome: 'A reliable local-first workflow.',
    constraints: [],
    scope: 'standard',
    researchMode: 'quick',
    privacyMode: 'local',
    requirements: [],
    useCases: [],
    nonGoals: [],
    risks: [],
    researchRunIds: [],
    researchBriefDraft: {
      title: 'Research Brief',
      mode: 'quick',
      privacyMode: 'local',
      preferredExecutor: 'agent',
      researchQuestions: [],
      searchTerms: [],
      preferredSourceTypes: ['nas'],
      excludeCriteria: [],
    },
    ...overrides,
  }
}

function card(overrides: Partial<MemoryCard>): MemoryCard {
  return {
    id: 'card-1',
    type: 'learning',
    title: 'Delegation learning',
    body: 'Useful result.',
    sourceIds: ['11111111-1111-4111-8111-111111111111'],
    tags: ['auto-extracted', 'delegation:11111111-1111-4111-8111-111111111111'],
    privacyClass: 'internal',
    confidence: 'high',
    createdAt: '2026-05-21T11:30:00.000Z',
    updatedAt: '2026-05-21T11:30:00.000Z',
    ...overrides,
  }
}

function attention(overrides: Partial<AttentionItem>): AttentionItem {
  return {
    id: 'attention-1',
    type: 'system_error',
    severity: 'warning',
    title: 'Needs review',
    body: 'A decision is pending.',
    createdAt: '2026-05-21T11:40:00.000Z',
    ...overrides,
  }
}

describe('buildDailyReport', () => {
  it('builds a JSON + Markdown report for Grok and agent handoff', () => {
    const report = buildDailyReport({
      now,
      storageMode: 'dual',
      authDisabled: false,
      projectBriefs: [brief({ status: 'accepted' }), brief({ id: 'brief-2', status: 'in_review' })],
      knowledgeCards: [card({})],
      attentionItems: [],
      delegations: [
        delegation({
          status: 'completed',
          summaryReport: { keyPoints: ['Done'], changes: [], timeTakenMinutes: 5, prUrl: 'https://github.com/Jokerbitt/forgepilot/pull/1' },
          criticScore: {
            correctness: 90,
            efficiency: 80,
            drift: 95,
            verdict: 'approved',
            summary: 'Good',
            runAt: '2026-05-21T11:05:00.000Z',
          },
        }),
      ],
    })

    expect(report.version).toBe(1)
    expect(report.executiveVerdict.status).toBe('green')
    expect(report.status.delegations.completed).toBe(1)
    expect(report.status.projectBriefs.inReview).toBe(1)
    expect(report.status.quality.criticCoveragePct).toBe(100)
    expect(report.status.quality.prsCreated).toBe(1)
    expect(report.status.quality.knowledgeWritebacks).toBe(1)
    expect(report.markdown).toContain('ForgePilot Daily Report')
    expect(report.prompts.some(prompt => prompt.target === 'grok')).toBe(true)
    expect(report.prompts.some(prompt => prompt.title === 'Coding validation pass')).toBe(true)
    expect(report.markdown).toContain('Coding validation pass')
  })

  it('raises critical risk when auth is disabled', () => {
    const report = buildDailyReport({
      now,
      storageMode: 'dual',
      authDisabled: true,
      projectBriefs: [],
      knowledgeCards: [],
      attentionItems: [],
      delegations: [],
    })

    expect(report.executiveVerdict.status).toBe('red')
    expect(report.risks.map(risk => risk.id)).toContain('auth-disabled')
    expect(report.nextActions[0]?.id).toBe('secure-local-auth')
  })

  it('flags JSON primary storage and low critic coverage', () => {
    const report = buildDailyReport({
      now,
      storageMode: 'json',
      authDisabled: false,
      projectBriefs: [],
      knowledgeCards: [],
      attentionItems: [],
      delegations: [
        delegation({ status: 'completed', criticScore: undefined }),
        delegation({ id: '22222222-2222-4222-8222-222222222222', status: 'failed' }),
      ],
    })

    expect(report.executiveVerdict.status).toBe('yellow')
    expect(report.risks.map(risk => risk.id)).toEqual(
      expect.arrayContaining(['json-primary-storage', 'failed-delegations', 'low-critic-coverage']),
    )
    expect(report.nextActions.map(action => action.id)).toContain('postgres-cutover-checklist')
  })

  it('detects stale running delegations and open attention items', () => {
    const report = buildDailyReport({
      now,
      storageMode: 'postgres',
      authDisabled: false,
      projectBriefs: [],
      knowledgeCards: [],
      attentionItems: [attention({})],
      delegations: [
        delegation({
          status: 'running',
          updatedAt: '2026-05-21T09:30:00.000Z',
        }),
      ],
    })

    expect(report.status.operations.staleRunningDelegations).toBe(1)
    expect(report.status.operations.openAttentionItems).toBe(1)
    expect(report.risks.map(risk => risk.id)).toEqual(
      expect.arrayContaining(['stale-running-delegations', 'open-attention-items']),
    )
  })
})

describe('renderDailyReportMarkdown', () => {
  it('renders stable markdown sections', () => {
    const report = buildDailyReport({
      now,
      storageMode: 'postgres',
      authDisabled: false,
      projectBriefs: [],
      knowledgeCards: [],
      attentionItems: [],
      delegations: [],
    })

    const markdown = renderDailyReportMarkdown(report)
    expect(markdown).toContain('## Executive Verdict')
    expect(markdown).toContain('## Top Risks')
    expect(markdown).toContain('## Next Actions')
  })
})
