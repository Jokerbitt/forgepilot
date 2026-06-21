import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { ingestDocs } from './doc-ingest'

let dir: string
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'fp-doc-')) })
afterEach(() => { rmSync(dir, { recursive: true, force: true }) })

function write(rel: string, content: string) {
  const abs = join(dir, rel)
  mkdirSync(join(abs, '..'), { recursive: true })
  writeFileSync(abs, content)
}

describe('ingestDocs', () => {
  it('returns empty hints when there are no docs', () => {
    write('src/index.ts', 'export const x = 1')
    expect(ingestDocs(dir)).toEqual({ sources: [], hints: [] })
  })

  it('extracts the tagline and feature hints from a README', () => {
    write('README.md', [
      '# Leitrechner CRM',
      '',
      'Eine Kundenverwaltung für den Innendienst mit Aufgaben und Notizen.',
      '',
      '## Funktionen',
      '- Kontakte verwalten',
      '- Firmen und Standorte',
      '- Aufgaben mit Fälligkeit',
      '',
      'See https://example.com for more.',
    ].join('\n'))
    const r = ingestDocs(dir)
    expect(r.sources).toContain('README.md')
    expect(r.tagline).toMatch(/Kundenverwaltung/)
    expect(r.hints).toContain('Funktionen')
    expect(r.hints).toContain('Kontakte verwalten')
    expect(r.hints).not.toContain('https://example.com for more.')
  })

  it('reads several doc files and de-duplicates hints', () => {
    write('README.md', '# A\n\nProjekt-Beschreibung hier.\n\n## Login\n- Login\n')
    write('ARCHITECTURE.md', '## Login\n- Login\n## Datenbank\n')
    const r = ingestDocs(dir)
    expect(r.sources.length).toBeGreaterThanOrEqual(2)
    expect(r.hints.filter(h => h === 'Login')).toHaveLength(1)
    expect(r.hints).toContain('Datenbank')
  })
})
