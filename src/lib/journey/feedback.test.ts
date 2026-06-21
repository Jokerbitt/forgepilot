import { describe, it, expect } from 'vitest'
import { classifyFeedback, feedbackToStep } from './feedback'

describe('classifyFeedback', () => {
  it('detects bugs', () => {
    expect(classifyFeedback('Es stürzt beim Speichern ab')).toBe('bug')
    expect(classifyFeedback('Der Button funktioniert nicht')).toBe('bug')
  })
  it('detects feature requests', () => {
    expect(classifyFeedback('Füge einen Export hinzu')).toBe('feature')
    expect(classifyFeedback('Ich möchte mich einloggen können')).toBe('feature')
  })
  it('detects UI tweaks', () => {
    expect(classifyFeedback('Mach den Button größer')).toBe('ui')
    expect(classifyFeedback('Die Farbe gefällt mir nicht')).toBe('ui')
  })
  it('falls back to generic change', () => {
    expect(classifyFeedback('Bitte das Impressum aktualisieren')).toBe('change')
  })
})

describe('feedbackToStep', () => {
  it('returns a titled, scoped step that preserves behaviour', () => {
    const step = feedbackToStep('Mach den Button größer')
    expect(step).not.toBeNull()
    expect(step!.kind).toBe('ui')
    expect(step!.title).toBe('UI-Anpassung')
    expect(step!.description).toContain('Button größer')
    expect(step!.description).toMatch(/erhalten/)
  })

  it('adds a regression-test note for bugs', () => {
    const step = feedbackToStep('Speichern stürzt ab')
    expect(step!.kind).toBe('bug')
    expect(step!.description).toMatch(/Test/)
  })

  it('returns null for too-short input', () => {
    expect(feedbackToStep('  ')).toBeNull()
    expect(feedbackToStep('ok')).toBeNull()
  })
})
