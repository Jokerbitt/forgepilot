import { describe, it, expect } from 'vitest'
import { APP_TEMPLATES, findTemplate, templateToSteps } from './templates'

describe('APP_TEMPLATES', () => {
  it('has unique ids and non-empty features', () => {
    const ids = APP_TEMPLATES.map(t => t.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(APP_TEMPLATES.every(t => t.features.length > 0)).toBe(true)
  })
})

describe('templateToSteps', () => {
  it('maps each feature to a validated step for a known template', () => {
    const steps = templateToSteps('crm')
    expect(steps).not.toBeNull()
    expect(steps!.length).toBe(findTemplate('crm')!.features.length)
    expect(steps![0]!.description).toMatch(/Build grün/)
    expect(steps![0]!.description).toContain('CRM')
  })

  it('returns null for an unknown template', () => {
    expect(templateToSteps('nope')).toBeNull()
  })
})
