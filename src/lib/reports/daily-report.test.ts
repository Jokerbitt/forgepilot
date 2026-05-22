import { describe, expect, it, vi } from 'vitest'
import type { AttentionItem } from '@/lib/models/attention'
import type { Delegation } from '@/lib/models/delegation'
import type { ProjectBrief } from '@/lib/models/project-brief'
import type { MemoryCard } from '@/lib/knowledge/types'
import { buildDailyReport, renderDailyReportMarkdown } from './daily-report'
import { getAuthReadiness } from '@/lib/auth/readiness'

vi.mock('@/lib/eval/grok-critic', () => ({
  getCriticProviderPlan: () => ({
    mode: 'auto',
    candidates: [
      { providerId: 'anthropic', model: 'claude-sonnet-4-5' },
      { providerId: 'ollama', model: 'qwen2.5-coder:14b' },
    ],
    description: 'auto (anthropic:claude-sonnet-4-5, ollama:qwen2.5-coder:14b)',
  }),
}))

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
  it('builds a JSON + Markdown report for universal LLM handoff', () => {
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
    expect(report.assistantRouting.recommended.providerId).toBe('anthropic')
    expect(report.firstRealValueLoop.progressPct).toBeGreaterThanOrEqual(80)
    expect(report.firstRealValueLoop.currentStep.id).toBe('writeback')
    expect(report.prompts.some(prompt => prompt.target === 'assistant-auto')).toBe(true)
    expect(report.prompts.some(prompt => prompt.title === 'Coding validation pass')).toBe(true)
    expect(report.markdown).toContain('Coding validation pass')
    expect(report.markdown).toContain('## Assistant Routing')
    expect(report.markdown).toContain('## First Real Value Loop')
    expect(report.markdown).toContain('## Execute Loop Evidence')
    expect(report.markdown).toContain('## Daily Assistant Readiness')
    expect(report.markdown).toContain('## Failed Delegation Triage')
    expect(report.dailyAssistant.status).toBe('attention')
    expect(report.dailyAssistant.score).toBeGreaterThanOrEqual(90)
    expect(report.dailyAssistant.checklist.map(item => item.id)).toEqual([
      'auth',
      'storage',
      'critic-router',
      'execute-evidence',
      'failed-delegations',
      'attention-items',
    ])
    expect(report.executeLoopEvidence.targetRuns).toBe(5)
    expect(report.executeLoopEvidence.provenRuns).toBe(1)
    expect(report.executeLoopEvidence.currentStatus).toBe('collecting')
  })

  it('counts repository memory cards linked by sourceId as knowledge writebacks', () => {
    const linkedCard = card({
      id: 'card-linked-by-source',
      sourceIds: ['11111111-1111-4111-8111-111111111111'],
      tags: ['completed', 'approved', 'local-agent'],
    })

    const report = buildDailyReport({
      now,
      storageMode: 'postgres',
      authDisabled: false,
      projectBriefs: [brief({ status: 'accepted' })],
      knowledgeCards: [linkedCard],
      attentionItems: [],
      delegations: [
        delegation({
          status: 'completed',
          summaryReport: {
            keyPoints: ['Done'],
            changes: [],
            timeTakenMinutes: 3,
            prUrl: 'https://github.com/Jokerbitt/forgepilot/pull/2',
          },
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

    expect(report.status.quality.knowledgeWritebacks).toBe(1)
    expect(report.firstRealValueLoop.progressPct).toBe(100)
    expect(report.firstRealValueLoop.currentStep.id).toBe('writeback')
    expect(report.firstRealValueLoop.currentStep.status).toBe('done')
    expect(report.firstRealValueLoop.currentStep.href).toMatch(/^\/idea\?prompt=/)
    expect(decodeURIComponent(report.firstRealValueLoop.currentStep.href)).toContain('kleines reales ForgePilot-Entwicklungsticket')
  })

  it('uses explicit execute loop evidence when recorded runs exist', () => {
    const report = buildDailyReport({
      now,
      storageMode: 'postgres',
      authDisabled: false,
      projectBriefs: [brief({ status: 'accepted' })],
      knowledgeCards: [],
      attentionItems: [],
      delegations: [],
      executeLoopEvidence: [
        {
          id: 'evidence-1',
          title: 'Daily Report CTA handoff',
          status: 'success',
          source: 'manual',
          recordedAt: '2026-05-21T12:00:00.000Z',
          prUrl: 'https://github.com/Jokerbitt/forgepilot/pull/400',
          timeSavedMinutes: 25,
          manualInterventions: 0,
          steps: {
            brief: true,
            delegation: true,
            execute: true,
            tests: true,
            pr: true,
            critic: true,
            writeback: true,
          },
        },
        {
          id: 'evidence-2',
          title: 'Blocked provider run',
          status: 'blocked',
          source: 'manual',
          recordedAt: '2026-05-21T13:00:00.000Z',
          blocker: 'Missing local model',
          steps: {
            brief: true,
            delegation: true,
            execute: false,
            tests: false,
            pr: false,
            critic: false,
            writeback: false,
          },
        },
      ],
    })

    expect(report.executeLoopEvidence.totalRuns).toBe(2)
    expect(report.executeLoopEvidence.provenRuns).toBe(1)
    expect(report.executeLoopEvidence.blockedRuns).toBe(1)
    expect(report.executeLoopEvidence.progressPct).toBe(20)
    expect(report.executeLoopEvidence.nextAction).toContain('4 more real small ticket loops')
    expect(report.markdown).toContain('Daily Report CTA handoff')
    expect(report.markdown).toContain('https://github.com/Jokerbitt/forgepilot/pull/400')
  })

  it('shows harness dry-runs without counting them as proven real loops', () => {
    const report = buildDailyReport({
      now,
      storageMode: 'postgres',
      authDisabled: false,
      projectBriefs: [],
      knowledgeCards: [],
      attentionItems: [],
      delegations: [],
      executeLoopEvidence: [
        {
          id: 'harness-1',
          title: 'Settings provider connectivity check',
          status: 'success',
          source: 'harness-dry-run',
          recordedAt: '2026-05-22T10:00:00.000Z',
          notes: 'Dry-run only.',
          steps: {
            brief: true,
            delegation: true,
            execute: true,
            tests: true,
            pr: true,
            critic: true,
            writeback: true,
          },
        },
      ],
    })

    expect(report.executeLoopEvidence.totalRuns).toBe(1)
    expect(report.executeLoopEvidence.provenRuns).toBe(0)
    expect(report.executeLoopEvidence.blockedRuns).toBe(0)
    expect(report.executeLoopEvidence.progressPct).toBe(0)
    expect(report.markdown).toContain('harness-dry-run')
    expect(report.markdown).toContain('Dry-run only.')
  })

  it('does not let blocked dry-runs mark the real loop as blocked', () => {
    const report = buildDailyReport({
      now,
      storageMode: 'postgres',
      authDisabled: false,
      projectBriefs: [],
      knowledgeCards: [],
      attentionItems: [],
      delegations: [],
      executeLoopEvidence: [
        {
          id: 'harness-blocked',
          title: 'Blocked provider escalation path',
          status: 'blocked',
          source: 'harness-dry-run',
          recordedAt: '2026-05-22T10:00:00.000Z',
          blocker: 'Provider unavailable',
          steps: {
            brief: true,
            delegation: true,
            execute: false,
            tests: false,
            pr: false,
            critic: false,
            writeback: true,
          },
        },
      ],
    })

    expect(report.executeLoopEvidence.blockedRuns).toBe(0)
    expect(report.executeLoopEvidence.currentStatus).toBe('collecting')
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
    expect(report.dailyAssistant.status).toBe('blocked')
    expect(report.dailyAssistant.checklist.find(item => item.id === 'auth')?.status).toBe('blocker')
    expect(report.nextActions[0]?.id).toBe('secure-local-auth')
    expect(report.firstRealValueLoop.currentStep.id).toBe('brief')
  })

  it('surfaces auth readiness blockers when auth is enabled but misconfigured', () => {
    const report = buildDailyReport({
      now,
      storageMode: 'postgres',
      authDisabled: false,
      authReadiness: getAuthReadiness({
        NEXTAUTH_URL: 'http://localhost:3000',
      } as unknown as NodeJS.ProcessEnv),
      projectBriefs: [],
      knowledgeCards: [],
      attentionItems: [],
      delegations: [],
    })

    expect(report.executiveVerdict.status).toBe('yellow')
    expect(report.risks.map(risk => risk.id)).toContain('auth-not-production-ready')
    expect(report.dailyAssistant.checklist.find(item => item.id === 'auth')?.status).toBe('blocker')
    expect(report.dailyAssistant.checklist.find(item => item.id === 'auth')?.detail).toContain('Admin password is missing')
    expect(report.markdown).toContain('Auth readiness: blocked')
  })

  it('flags JSON primary storage and low critic coverage', () => {
    const report = buildDailyReport({
      now,
      storageMode: 'json',
      authDisabled: false,
      projectBriefs: [brief({ status: 'accepted' })],
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
    expect(report.dailyAssistant.status).toBe('blocked')
    expect(report.dailyAssistant.checklist.find(item => item.id === 'storage')?.status).toBe('warning')
    expect(report.dailyAssistant.checklist.find(item => item.id === 'failed-delegations')?.status).toBe('blocker')
    expect(report.dailyAssistant.checklist.find(item => item.id === 'failed-delegations')?.detail).toContain('1 ohne Fehlertext')
    expect(report.failedDelegationTriage.missingFeedback).toBe(1)
    expect(report.markdown).toContain('Missing feedback: 1')
    expect(report.markdown).toContain('No errorMessage, failureFeedback, warning or error log found.')
    expect(report.firstRealValueLoop.currentStep.id).toBe('pr')
    expect(report.firstRealValueLoop.currentStep.status).toBe('active')
  })

  it('shows retryable failed delegation triage in markdown', () => {
    const report = buildDailyReport({
      now,
      storageMode: 'postgres',
      authDisabled: false,
      projectBriefs: [brief({ status: 'accepted' })],
      knowledgeCards: [],
      attentionItems: [],
      delegations: [
        delegation({
          id: '33333333-3333-4333-8333-333333333333',
          title: 'Provider timeout',
          status: 'failed',
          errorMessage: 'Request timed out while calling Ollama',
        }),
      ],
    })

    expect(report.failedDelegationTriage.retryable).toBe(1)
    expect(report.failedDelegationTriage.topItems[0]).toMatchObject({
      title: 'Provider timeout',
      category: 'retryable',
      failureCause: 'timeout',
    })
    expect(report.markdown).toContain('Retryable: 1')
    expect(report.markdown).toContain('Provider timeout: retryable/timeout')
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
    expect(report.dailyAssistant.checklist.find(item => item.id === 'attention-items')?.status).toBe('warning')
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
    expect(markdown).toContain('## First Real Value Loop')
    expect(markdown).toContain('## Assistant Routing')
    expect(markdown).toContain('## Daily Assistant Readiness')
    expect(markdown).toContain('## Top Risks')
    expect(markdown).toContain('## Next Actions')
  })
})
