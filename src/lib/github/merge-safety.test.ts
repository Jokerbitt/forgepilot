import { describe, expect, it } from 'vitest'
import { evaluateMergeSafety } from './merge-safety'
import type { GitHubPullRequestPreview } from '@/lib/connectors/github'
import type { Delegation } from '@/lib/models/delegation'

function preview(overrides: Partial<GitHubPullRequestPreview> = {}): GitHubPullRequestPreview {
  return {
    number: 12,
    title: 'Safe UI polish',
    url: 'https://github.com/Jokerbitt/forgepilot/pull/12',
    state: 'open',
    draft: false,
    headRef: 'feature/safe-ui-polish',
    headSha: 'abc123',
    baseRef: 'main',
    updatedAt: '2026-05-28T10:00:00.000Z',
    mergeable: true,
    additions: 80,
    deletions: 20,
    changedFiles: 2,
    commits: 1,
    risk: 'low',
    files: [
      { filename: 'src/components/Foo.tsx', status: 'modified', additions: 80, deletions: 20, changes: 100 },
    ],
    commitMessages: [{ sha: 'abc123', message: 'Polish UI' }],
    checks: { state: 'success', items: [{ name: 'build', status: 'success' }] },
    mergeRecommendation: { status: 'ready', reasons: ['PR ist offen, mergebar und Checks sind gruen.'] },
    ...overrides,
  }
}

function delegation(overrides: Partial<Delegation> = {}): Delegation {
  return {
    id: 'd1',
    title: 'Safe UI polish',
    status: 'completed',
    executionRoute: 'runner',
    costEstimateUsd: 1,
    createdAt: '2026-05-28T10:00:00.000Z',
    updatedAt: '2026-05-28T10:00:00.000Z',
    contract: {
      id: 'c1',
      workItemId: 'JOK-1',
      goal: 'Polish UI',
      context: '',
      definitionOfDone: ['Build passes'],
      riskClass: 'A',
      maxBudgetUsd: 1,
      allowedTools: ['edit'],
      branchStrategy: 'feature',
      requiresApproval: false,
      privacyMode: 'local',
      createdAt: '2026-05-28T10:00:00.000Z',
    },
    criticScore: {
      correctness: 92,
      efficiency: 90,
      drift: 88,
      verdict: 'approved',
      summary: 'Good',
      runAt: '2026-05-28T10:00:00.000Z',
    },
    ...overrides,
  }
}

describe('evaluateMergeSafety', () => {
  it('allows auto-merge for small Risk A PRs with green CI and approved critic', () => {
    const verdict = evaluateMergeSafety(preview(), { delegation: delegation(), mode: 'auto' })

    expect(verdict.status).toBe('ready')
  })

  it('blocks auto-merge for Risk B delegations', () => {
    const verdict = evaluateMergeSafety(preview(), {
      delegation: delegation({ contract: { ...delegation().contract, riskClass: 'B' } }),
      mode: 'auto',
    })

    expect(verdict.status).toBe('blocked')
    expect(verdict.reasons.join(' ')).toContain('Risk A')
  })

  it('requires review for large diffs even when CI is green', () => {
    const verdict = evaluateMergeSafety(preview({ additions: 400, deletions: 10, changedFiles: 2 }), {
      delegation: delegation(),
      mode: 'auto',
    })

    expect(verdict.status).toBe('review')
    expect(verdict.reasons.join(' ')).toContain('Zu große Änderung')
  })

  it('blocks possible secrets in patches', () => {
    const verdict = evaluateMergeSafety(preview({
      files: [
        {
          filename: 'src/config.ts',
          status: 'modified',
          additions: 1,
          deletions: 0,
          changes: 1,
          patchPreview: '+ token = "sk_live_12345678901234567890"',
        },
      ],
    }), { delegation: delegation(), mode: 'auto' })

    expect(verdict.status).toBe('blocked')
    expect(verdict.reasons.join(' ')).toContain('sensible Werte')
  })

  it('blocks auto-merge for budget-stopped delegations even when CI is green', () => {
    const verdict = evaluateMergeSafety(preview(), {
      delegation: delegation({
        status: 'failed',
        actualCostUsd: 1.57,
        errorMessage: 'Budget exceeded: $1.5700 > $0.5000 limit',
        contract: { ...delegation().contract, riskClass: 'A', maxCostUsd: 0.5 },
      }),
      mode: 'auto',
    })

    expect(verdict.status).toBe('blocked')
    expect(verdict.reasons.join(' ')).toContain('Budget überschritten')
    expect(verdict.reasons.join(' ')).toContain('abgeschlossene Delegationen')
  })

  it('keeps manual merge in review for budget-stopped PRs', () => {
    const verdict = evaluateMergeSafety(preview(), {
      delegation: delegation({
        status: 'failed',
        actualCostUsd: 1.57,
        errorMessage: 'Budget exceeded: $1.5700 > $0.5000 limit',
        contract: { ...delegation().contract, riskClass: 'A', maxCostUsd: 0.5 },
      }),
      mode: 'manual',
    })

    expect(verdict.status).toBe('review')
    expect(verdict.reasons.join(' ')).toContain('Budget überschritten')
  })
})
