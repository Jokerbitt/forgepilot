import { describe, expect, it, vi } from 'vitest'
import {
  applyPlanningItems,
  buildPlanningItems,
  parseGrokPlanningActionPlan,
  renderPlanningPrompt,
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

  it('creates GitHub and Linear issues when explicitly requested', async () => {
    const items = buildPlanningItems(parseGrokPlanningActionPlan(plan))
    const fetcher = vi.fn(async (input: URL | RequestInfo) => {
      const url = String(input)
      if (url.includes('linear.app')) {
        return Response.json({
          data: {
            issueCreate: {
              success: true,
              issue: { id: 'lin-1', identifier: 'JOK-1', url: 'https://linear.app/test/JOK-1' },
            },
          },
        })
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
  })

  it('gives Grok a schema-only prompt without asking for secrets', () => {
    const prompt = renderPlanningPrompt()

    expect(prompt).toContain('valide')
    expect(prompt).toContain('ohne Secrets')
    expect(prompt).toContain('milestones')
  })
})
