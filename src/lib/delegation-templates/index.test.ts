import { describe, it, expect } from 'vitest'
import { DELEGATION_TEMPLATES, getTemplate } from './index'

describe('DELEGATION_TEMPLATES', () => {
  it('has 5 templates', () => {
    expect(DELEGATION_TEMPLATES).toHaveLength(5)
  })

  it('all templates have required fields', () => {
    for (const t of DELEGATION_TEMPLATES) {
      expect(t.id).toBeTruthy()
      expect(t.name).toBeTruthy()
      expect(t.defaultContract.riskClass).toMatch(/^[ABC]$/)
      expect(t.defaultContract.acceptanceCriteria.length).toBeGreaterThan(0)
    }
  })

  it('getTemplate returns correct template by id', () => {
    expect(getTemplate('bug-fix')?.name).toBe('Bug Fix')
    expect(getTemplate('nonexistent')).toBeUndefined()
  })
})
