/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest'
import type { TodoPlannerDemoRun } from './lib'
import {
  buildTodoPlannerDelegation,
  buildTodoPlannerDemoRun,
  buildTodoPlannerNextPrStep,
} from './lib'

describe('buildTodoPlannerDelegation', () => {
  it('returns a typed delegation with goal, DoD and risk class A', () => {
    const delegation = buildTodoPlannerDelegation()

    expect(delegation.id).toMatch(/demo-deleg-todo-planner/)
    expect(delegation.contract.goal).toContain('ToDo Planner')
    expect(delegation.contract.riskClass).toBe('A')
    expect(delegation.contract.definitionOfDone.length).toBeGreaterThanOrEqual(3)
    expect(delegation.executionRoute).toBe('runner')
    expect(delegation.contract.allowedFilePatterns).toContain('src/app/demo/todo-planner/**')
    expect(delegation.contract.allowedFilePatterns).toContain('src/app/api/demo-runs/**')
  })

  it('marks the delegation as approved so it is ready for the next run', () => {
    const delegation = buildTodoPlannerDelegation()
    expect(delegation.status).toBe('approved')
  })
})

describe('buildTodoPlannerNextPrStep', () => {
  it('names the next productive PR step with branch, title and DoD', () => {
    const step = buildTodoPlannerNextPrStep()

    expect(step.title.toLowerCase()).toContain('todo planner')
    expect(step.branch).toBe('feature/todo-planner-tasks-v1')
    expect(step.baseBranch).toBe('main')
    expect(step.definitionOfDone.length).toBeGreaterThanOrEqual(3)
    expect(step.suggestedFiles.length).toBeGreaterThanOrEqual(2)
    expect(step.runbook.some(line => line.startsWith('git checkout -b '))).toBe(true)
    expect(step.runbook.some(line => line.includes('gh pr create'))).toBe(true)
  })
})

describe('buildTodoPlannerDemoRun', () => {
  it('bundles stages, delegation and next PR step into one demo run', () => {
    const run: TodoPlannerDemoRun = buildTodoPlannerDemoRun('2026-05-29T08:00:00.000Z')

    expect(run.id).toBe('demo-todo-planner-001')
    expect(run.goal).toContain('ToDo Planner')
    expect(run.stages.map(stage => stage.id)).toEqual([
      'idea',
      'plan',
      'delegation',
      'execute',
      'pr',
    ])
    const delegationStage = run.stages.find(stage => stage.id === 'delegation')
    expect(delegationStage?.status).toBe('done')
    const prStage = run.stages.find(stage => stage.id === 'pr')
    expect(prStage?.status).toBe('active')
    expect(run.delegation.contract.goal).toContain('ToDo Planner')
    expect(run.nextPrStep.branch).toBe('feature/todo-planner-tasks-v1')
  })
})

describe('GET /api/demo-runs', () => {
  it('serves the ToDo Planner demo run including delegation and next PR step', async () => {
    const { GET } = await import('./route')
    const response = await GET()
    expect(response.status).toBe(200)

    const body = (await response.json()) as {
      ok: boolean
      demoRun: TodoPlannerDemoRun
    }

    expect(body.ok).toBe(true)
    expect(body.demoRun.id).toBe('demo-todo-planner-001')
    expect(body.demoRun.delegation.contract.riskClass).toBe('A')
    expect(body.demoRun.nextPrStep.branch).toBe('feature/todo-planner-tasks-v1')
    expect(body.demoRun.stages.find(stage => stage.id === 'delegation')?.status).toBe('done')
  })
})
