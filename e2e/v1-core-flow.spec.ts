import { expect, test } from '@playwright/test'

const unique = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`

test.describe('V1 Core Flow — Idea → Brief → Delegation → Review surface', () => {
  test('creates a brief, creates a delegation, completes it, and opens the review-ready detail page', async ({ page, request }) => {
    const runId = unique()
    const title = `E2E V1 Core Flow ${runId}`

    const briefRes = await request.post('/api/project-briefs', {
      data: {
        title,
        rawIdea:
          'Create a focused ForgePilot validation flow that proves the product can turn an idea into a controlled delegation.',
        problemStatement: 'Solo developers need proof that the core workflow is connected end to end.',
        targetAudience: 'Solo developers and technical founders',
        desiredOutcome: 'A created delegation reaches a review-ready completed state with clear evidence.',
        constraints: ['local-first', 'no external AI required in the test', 'deterministic CI execution'],
        scope: 'standard',
        researchMode: 'quick',
        privacyMode: 'local',
      },
    })
    expect(briefRes.status()).toBe(201)
    const brief = (await briefRes.json()) as { id: string; title: string }

    const acceptRes = await request.patch(`/api/project-briefs/${brief.id}`, {
      data: {
        status: 'accepted',
        reviewedBy: 'playwright',
        reviewedAt: new Date().toISOString(),
      },
    })
    expect(acceptRes.status()).toBe(200)

    const delegationRes = await request.post(`/api/project-briefs/${brief.id}/create-delegation`)
    expect(delegationRes.status()).toBe(201)
    const delegation = (await delegationRes.json()) as { id: string; title: string }

    const approveRes = await request.post(`/api/delegations/${delegation.id}/approve`, {
      data: { source: 'playwright', note: 'V1 core-flow proof' },
    })
    expect(approveRes.status()).toBe(200)

    const loadedDelegationRes = await request.get(`/api/delegations/${delegation.id}`)
    expect(loadedDelegationRes.status()).toBe(200)
    const loadedDelegation = (await loadedDelegationRes.json()) as Record<string, unknown>

    const completedRes = await request.post('/api/delegations', {
      data: {
        ...loadedDelegation,
        status: 'completed',
        summaryReport: {
          keyPoints: ['Brief accepted', 'Delegation created', 'Review surface available'],
          changes: ['Validated V1 core flow without external AI dependency'],
          timeTakenMinutes: 1,
          testsPassed: 1,
          prUrl: 'https://github.com/Jokerbitt/forgepilot/pull/298',
        },
      },
    })
    expect(completedRes.status()).toBe(200)

    await page.goto(`/delegations/${delegation.id}`)

    await expect(page.getByRole('heading', { name: delegation.title })).toBeVisible()
    await expect(page.getByText('Fertig').first()).toBeVisible()
    await expect(page.getByText('Ergebnis')).toBeVisible()
    await expect(page.getByText('Grok Critic')).toBeVisible()
    await expect(page.getByText('Review surface available')).toBeVisible()
  })
})
