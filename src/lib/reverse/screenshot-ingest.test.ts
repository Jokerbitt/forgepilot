import { describe, it, expect } from 'vitest'
import { parseScreenshotHints, buildScreenshotHintText, isEmptyHints, type ScreenshotHints } from './screenshot-ingest'

describe('parseScreenshotHints', () => {
  it('parses a clean JSON response', () => {
    const raw = JSON.stringify({
      summary: 'Kundenliste mit Filtern',
      screens: ['Kundenliste', 'Detailansicht'],
      features: ['Kontakte verwalten', 'Suche'],
      uiElements: ['Tabelle', 'Suchfeld', 'Speichern-Button'],
    })
    const h = parseScreenshotHints(raw)
    expect(h.summary).toBe('Kundenliste mit Filtern')
    expect(h.screens).toEqual(['Kundenliste', 'Detailansicht'])
    expect(h.features).toContain('Suche')
    expect(h.uiElements).toHaveLength(3)
  })

  it('handles a fenced JSON code block', () => {
    const raw = '```json\n{"summary":"X","screens":["A"],"features":[],"uiElements":[]}\n```'
    expect(parseScreenshotHints(raw).summary).toBe('X')
    expect(parseScreenshotHints(raw).screens).toEqual(['A'])
  })

  it('returns empty hints for junk / non-JSON', () => {
    expect(parseScreenshotHints('not json at all')).toEqual({ summary: '', screens: [], features: [], uiElements: [] })
  })

  it('ignores non-string array items and missing fields', () => {
    const h = parseScreenshotHints('{"screens":["ok",1,null,"  "],"features":"nope"}')
    expect(h.screens).toEqual(['ok'])
    expect(h.features).toEqual([])
    expect(h.summary).toBe('')
  })
})

describe('buildScreenshotHintText', () => {
  it('renders a plain-German note from hints', () => {
    const hints: ScreenshotHints = { summary: 'Ein CRM.', screens: ['Liste'], features: ['Suche'], uiElements: ['Tabelle'] }
    const text = buildScreenshotHintText(hints)
    expect(text).toContain('Ein CRM.')
    expect(text).toContain('Screens: Liste.')
    expect(text).toContain('Funktionen: Suche.')
    expect(text).toContain('UI-Elemente: Tabelle.')
  })

  it('omits empty sections', () => {
    expect(buildScreenshotHintText({ summary: 'Nur Text', screens: [], features: [], uiElements: [] })).toBe('Nur Text')
  })
})

describe('isEmptyHints', () => {
  it('detects empty vs. non-empty hints', () => {
    expect(isEmptyHints({ summary: '', screens: [], features: [], uiElements: [] })).toBe(true)
    expect(isEmptyHints({ summary: '', screens: ['A'], features: [], uiElements: [] })).toBe(false)
  })
})
