import { describe, expect, it, vi } from 'vitest'
import {
  applyPlanningItems,
  buildPlanningAudit,
  buildPlanningItems,
  computePlanningPayloadHash,
  parseGrokPlanningActionPlan,
  PlanningPayloadSafetyError,
  renderPlanningPrompt,
  summarizePlanningRequest,
} from './grok-planning-gateway'

const plan = {
  milestones: [{
    title: 'Secure ForgePilot V1',
    goal: 'Close the most important V1 security and persistence gaps.',
    priority: 'P0',
    system: 'both',
    acceptanceCriteria: ['Auth and persistence risks are visible and tracked.'],
    issues: [{
      title: 'Verify mandatory local auth',
      description: 'Check that local auth cannot be bypassed outside explicit test mode.',
      priority: 'P0',
      labels: ['security', 'MVP'],
      owner: 'codex',
      writeScope: ['src/lib/auth/**', 'src/middleware.ts'],
      acceptanceCriteria: ['Protected API routes reject anonymous callers.'],
      verification: ['npm run type-check', 'npm run test:run -- src/lib/auth/config.test.ts'],
    }],
  }],
  doNotBuild: ['Billing'],
  risks: [{ title: 'Auth bypass', severity: 'critical', mitigation: 'Require explicit dev flag.' }],
}

describe('grok planning gateway', () => {
  it('parses Grok action JSON and builds normalized planning items', () => {
    const parsed = parseGrokPlanningActionPlan(plan)
    const items = buildPlanningItems(parsed)

    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      title: '[P0] Verify mandatory local auth',
      milestoneTitle: 'Secure ForgePilot V1',
      linearPriority: 1,
      owner: 'codex',
    })
    expect(items[0].githubLabels).toEqual(expect.arrayContaining(['forgepilot', 'grok-planning', 'p0', 'security', 'mvp']))
    expect(items[0].body).toContain('## Acceptance Criteria')
  })

  it('does not create external issues in preview mode', async () => {
    const items = buildPlanningItems(parseGrokPlanningActionPlan(plan))
    const fetcher = vi.fn()

    const result = await applyPlanningItems(items, {
      mode: 'preview',
      fetcher,
      linearConfig: { apiKey: 'lin_api_test', teamId: 'team-1' },
      githubConfig: { token: 'ghp_test', owner: 'Jokerbitt', repositories: ['forgepilot'] },
    })

    expect(result.created).toEqual([])
    expect(result.skipped).toEqual([])
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('rejects planning payloads that contain credentials', () => {
    const unsafePlan = structuredClone(plan)
    unsafePlan.milestones[0].issues[0].description = 'Use GITHUB_TOKEN=ghp_123456789012345678901234567890123456'

    expect(() => parseGrokPlanningActionPlan(unsafePlan)).toThrow(PlanningPayloadSafetyError)
  })

  it('rejects labels outside the MVP planning allowlist', () => {
    const invalidPlan = structuredClone(plan)
    invalidPlan.milestones[0].issues[0].labels = ['security', 'billing']

    expect(() => parseGrokPlanningActionPlan(invalidPlan)).toThrow(PlanningPayloadSafetyError)
  })

  it('creates deterministic summary and audit metadata', () => {
    const parsed = parseGrokPlanningActionPlan(plan)
    const items = buildPlanningItems(parsed)
    const summary = summarizePlanningRequest(parsed, items)
    const applyResult = { mode: 'preview' as const, created: [], skipped: [] }
    const audit = buildPlanningAudit('preview', parsed, items, applyResult, new Date('2026-05-21T10:00:00.000Z'))

    expect(summary).toMatchObject({
      milestones: 1,
      items: 1,
      targetCounts: { linear: 1, github: 1 },
      priorityCounts: { P0: 1, P1: 0, P2: 0 },
      ownerCounts: { codex: 1, claude: 0, grok: 0, human: 0 },
    })
    expect(summary.payloadHash).toEqual(computePlanningPayloadHash(parsed))
    expect(audit).toMatchObject({
      action: 'grok-planning',
      mode: 'preview',
      payloadHash: summary.payloadHash,
      itemCount: 1,
      createdCount: 0,
      skippedCount: 0,
      createdAt: '2026-05-21T10:00:00.000Z',
    })
  })

  it('creates GitHub and Linear issues when explicitly requested', async () => {
    const items = buildPlanningItems(parseGrokPlanningActionPlan(plan))
    const fetcher = vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('linear.app')) {
        const body = JSON.parse(String(init?.body ?? '{}')) as { query?: string }
        if (body.query?.includes('FindIssueByTitle')) {
          return Response.json({ data: { issues: { nodes: [] } } })
        }

        return Response.json({
          data: {
            issueCreate: {
              success: true,
              issue: { id: 'lin-1', identifier: 'JOK-1', url: 'https://linear.app/test/JOK-1' },
            },
          },
        })
      }

      if (init?.method !== 'POST') {
        return Response.json([])
      }

      return Response.json({
        id: 123,
        number: 42,
        html_url: 'https://github.com/Jokerbitt/forgepilot/issues/42',
        title: '[P0] Verify mandatory local auth',
      })
    })

    const result = await applyPlanningItems(items, {
      mode: 'create-all',
      fetcher,
      linearConfig: { apiKey: 'lin_api_test', teamId: 'team-1' },
      githubConfig: { token: 'ghp_test', owner: 'Jokerbitt', repositories: ['forgepilot'] },
    })

    expect(result.created).toHaveLength(2)
    expect(result.created.map(item => item.target)).toEqual(['linear', 'github'])
    expect(result.skipped).toEqual([])
    expect(fetcher).toHaveBeenCalledTimes(4)
  })

  it('skips existing GitHub and Linear issues instead of duplicating them', async () => {
    const items = buildPlanningItems(parseGrokPlanningActionPlan(plan))
    const fetcher = vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('linear.app')) {
        return Response.json({
          data: {
            issues: {
              nodes: [{ id: 'lin-1', identifier: 'JOK-1', url: 'https://linear.app/test/JOK-1', title: '[P0] Verify mandatory local auth' }],
            },
          },
        })
      }

      return Response.json([{
        id: 123,
        number: 42,
        html_url: 'https://github.com/Jokerbitt/forgepilot/issues/42',
        title: '[P0] Verify mandatory local auth',
      }])
    })

    const result = await applyPlanningItems(items, {
      mode: 'create-all',
      fetcher,
      linearConfig: { apiKey: 'lin_api_test', teamId: 'team-1' },
      githubConfig: { token: 'ghp_test', owner: 'Jokerbitt', repositories: ['forgepilot'] },
    })

    expect(result.created).toEqual([])
    expect(result.skipped).toEqual([
      { target: 'linear', title: '[P0] Verify mandatory local auth', reason: 'Already exists: JOK-1' },
      { target: 'github', title: '[P0] Verify mandatory local auth', reason: 'Already exists: #42' },
    ])
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('gives Grok a schema-only prompt without asking for secrets', () => {
    const prompt = renderPlanningPrompt()

    expect(prompt).toContain('valide')
    expect(prompt).toContain('ohne Secrets')
    expect(prompt).toContain('milestones')
  })
})
