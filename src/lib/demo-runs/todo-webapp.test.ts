import { describe, expect, it } from 'vitest'
import { buildTodoWebAppDemoRun } from './todo-webapp'

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
})
