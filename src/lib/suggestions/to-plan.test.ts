import { describe, it, expect } from 'vitest'
import { suggestionsToPlan } from './to-plan'

function idFactory() {
  let n = 0
  return () => `id-${++n}`
}

const NOW = '2026-06-20T00:00:00.000Z'

describe('suggestionsToPlan', () => {
  it('creates one phase per selection, sequential + validated', () => {
    const plan = suggestionsToPlan({
      goal: 'Make ProjectFlow a gamechanger',
      context: 'Next.js SaaS',
      targetRepo: '/repo',
      selected: [
        { id: 's1', title: 'Smart Priority', description: 'AI ranking' },
        { id: 's2', title: 'Insights', description: 'dashboards' },
      ],
      newId: idFactory(),
      now: NOW,
    })
    expect(plan.phases).toHaveLength(2)
    // First phase has no deps; second depends on the first → sequential
    expect(plan.phases[0]!.dependsOn).toEqual([])
    expect(plan.phases[1]!.dependsOn).toEqual([plan.phases[0]!.id])
    // Every phase enforces the validation gate
    for (const p of plan.phases) {
      expect(p.dodItems).toContain('npm run build green (production)')
      expect(p.dodItems).toContain('All Vitest tests pass')
      expect(p.dodItems).toContain('TypeScript 0 errors')
    }
    expect(plan.targetRepo).toBe('/repo')
    expect(plan.status).toBe('draft')
  })

  it('appends a custom step as an extra phase', () => {
    const plan = suggestionsToPlan({
      goal: 'g',
      selected: [{ id: 's1', title: 'A', description: 'a' }],
      custom: 'Add a dark mode toggle',
      newId: idFactory(),
      now: NOW,
    })
    expect(plan.phases).toHaveLength(2)
    expect(plan.phases[1]!.title).toBe('Custom step')
    expect(plan.phases[1]!.description).toBe('Add a dark mode toggle')
  })

  it('ignores blank custom and works with custom only', () => {
    const onlyCustom = suggestionsToPlan({ goal: 'g', selected: [], custom: 'Just this', newId: idFactory(), now: NOW })
    expect(onlyCustom.phases).toHaveLength(1)
    expect(onlyCustom.phases[0]!.description).toBe('Just this')

    const blank = suggestionsToPlan({ goal: 'g', selected: [{ id: 's1', title: 'A', description: 'a' }], custom: '   ', newId: idFactory(), now: NOW })
    expect(blank.phases).toHaveLength(1)
  })

  it('passes through an optional overall budget', () => {
    const withBudget = suggestionsToPlan({ goal: 'g', selected: [{ id: 's1', title: 'A', description: 'a' }], totalBudgetUsd: 12, newId: idFactory(), now: NOW })
    expect(withBudget.totalBudgetUsd).toBe(12)

    const without = suggestionsToPlan({ goal: 'g', selected: [{ id: 's1', title: 'A', description: 'a' }], newId: idFactory(), now: NOW })
    expect(without.totalBudgetUsd).toBeUndefined()
  })
})
