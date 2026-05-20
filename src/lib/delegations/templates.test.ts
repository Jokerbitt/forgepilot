import { describe, it, expect } from 'vitest'
import {
  DELEGATION_TEMPLATES,
  getTemplates,
  getTemplate,
  templateToContract,
} from './templates'

describe('DELEGATION_TEMPLATES', () => {
  it('has at least 8 templates', () => {
    expect(DELEGATION_TEMPLATES.length).toBeGreaterThanOrEqual(8)
  })

  it('every template has required fields', () => {
    for (const t of DELEGATION_TEMPLATES) {
      expect(t.id, `${t.id} missing id`).toBeTruthy()
      expect(t.name, `${t.id} missing name`).toBeTruthy()
      expect(t.goal, `${t.id} missing goal`).toBeTruthy()
      expect(t.acceptanceCriteria.length, `${t.id} missing criteria`).toBeGreaterThan(0)
      expect(['A', 'B', 'C']).toContain(t.riskClass)
      expect(['feature', 'fix', 'chore']).toContain(t.branchStrategy)
    }
  })

  it('all template IDs are unique', () => {
    const ids = DELEGATION_TEMPLATES.map(t => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('maxBudgetUsd is positive for all templates', () => {
    for (const t of DELEGATION_TEMPLATES) {
      expect(t.maxBudgetUsd).toBeGreaterThan(0)
    }
  })
})

describe('getTemplates', () => {
  it('returns all templates when no category given', () => {
    expect(getTemplates().length).toBe(DELEGATION_TEMPLATES.length)
  })

  it('filters by category', () => {
    const tests = getTemplates('test')
    expect(tests.length).toBeGreaterThan(0)
    expect(tests.every(t => t.category === 'test')).toBe(true)
  })

  it('returns empty array for unknown category', () => {
    expect(getTemplates('unknown' as never)).toHaveLength(0)
  })
})

describe('getTemplate', () => {
  it('returns template by id', () => {
    const t = getTemplate('add-api-route')
    expect(t).toBeDefined()
    expect(t?.name).toBe('Add API Route')
  })

  it('returns undefined for unknown id', () => {
    expect(getTemplate('does-not-exist')).toBeUndefined()
  })
})

describe('templateToContract', () => {
  it('maps all required contract fields', () => {
    const template = getTemplate('add-api-route')!
    const contract = templateToContract(template)
    expect(contract.goal).toBe(template.goal)
    expect(contract.acceptanceCriteria).toEqual(template.acceptanceCriteria)
    expect(contract.riskClass).toBe(template.riskClass)
    expect(contract.branchStrategy).toBe(template.branchStrategy)
    expect(contract.requiresApproval).toBe(template.requiresApproval)
    expect(contract.maxBudgetUsd).toBe(template.maxBudgetUsd)
  })

  it('sets empty string for context when undefined', () => {
    const template = getTemplate('write-docs')!
    const contract = templateToContract(template)
    expect(contract.context).toBe('')
  })
})
