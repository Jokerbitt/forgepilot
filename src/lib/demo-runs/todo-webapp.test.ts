import { describe, expect, it } from 'vitest'
import { buildTodoWebAppDemoRun, buildTodoWebAppRunnerPrDelegation } from './todo-webapp'

describe('buildTodoWebAppDemoRun', () => {
  it('creates a project brief, completed delegation, logs and app preview link', () => {
    const now = new Date('2026-05-26T10:00:00.000Z')
    const run = buildTodoWebAppDemoRun(now, {
      briefId: 'brief-demo',
      delegationId: '11111111-1111-4111-8111-111111111111',
    })

    expect(run.brief.title).toBe('Demo: ToDo Planner WebApp')
    expect(run.brief.status).toBe('accepted')
    expect(run.brief.targetPlatform).toBe('webapp')
    expect(run.brief.persistenceStrategy).toBe('json_file')
    expect(run.brief.delegationIds).toEqual(['11111111-1111-4111-8111-111111111111'])

    expect(run.delegation.status).toBe('completed')
    expect(run.delegation.briefId).toBe('brief-demo')
    expect(run.delegation.logs?.length).toBeGreaterThanOrEqual(5)
    expect(run.delegation.summaryReport?.filesAdded).toContain('src/app/demo/todo-planner/page.tsx')
    expect(run.delegation.criticScore?.verdict).toBe('approved')
    expect(run.appPreviewHref).toBe('/demo/todo-planner')
  })

  it('creates a narrow approved runner PR proof delegation', () => {
    const delegation = buildTodoWebAppRunnerPrDelegation(
      new Date('2026-05-26T10:00:00.000Z'),
      { briefId: 'brief-demo', delegationId: '22222222-2222-4222-8222-222222222222' },
    )

    expect(delegation.status).toBe('approved')
    expect(delegation.executionRoute).toBe('runner')
    expect(delegation.contract.maxBudgetUsd).toBeGreaterThan(0)
    expect(delegation.contract.definitionOfDone).toContain('Tasks persist across page reloads via localStorage.')
    expect(delegation.contract.allowedFilePatterns).toContain('src/app/demo/todo-planner/**')
    expect(delegation.tags).toContain('runner-pr-proof')
  })
})
