import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { updateLevel, parseOutdated, buildMaintenanceReport } from './maintenance'

describe('updateLevel', () => {
  it('classifies major, minor, patch', () => {
    expect(updateLevel('1.2.3', '2.0.0')).toBe('major')
    expect(updateLevel('1.2.3', '1.5.0')).toBe('minor')
    expect(updateLevel('1.2.3', '1.2.9')).toBe('patch')
  })
  it('handles caret/tilde prefixes', () => {
    expect(updateLevel('^1.0.0', '2.0.0')).toBe('major')
  })
})

describe('parseOutdated', () => {
  it('parses and sorts npm outdated json (major first)', () => {
    const json = JSON.stringify({
      lodash: { current: '4.17.0', latest: '4.17.21' },
      next: { current: '13.0.0', latest: '14.2.0' },
    })
    const deps = parseOutdated(json)
    expect(deps[0]).toMatchObject({ name: 'next', level: 'major' })
    expect(deps.some(d => d.name === 'lodash' && d.level === 'patch')).toBe(true)
  })
  it('skips packages already at latest', () => {
    const json = JSON.stringify({ a: { current: '1.0.0', latest: '1.0.0' } })
    expect(parseOutdated(json)).toEqual([])
  })
  it('handles empty / invalid input', () => {
    expect(parseOutdated('')).toEqual([])
    expect(parseOutdated('not json')).toEqual([])
  })
})

describe('buildMaintenanceReport', () => {
  let dir: string
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'fp-maint-')) })
  afterEach(() => { rmSync(dir, { recursive: true, force: true }) })

  it('combines security findings and outdated deps into a summary', () => {
    writeFileSync(join(dir, 'package.json'), '{}')
    writeFileSync(join(dir, 'app.cs'), 'var cs = "Server=x;Password=secret123;";')
    const fakeNpm = { outdated: () => JSON.stringify({ next: { current: '13.0.0', latest: '14.0.0' } }) }
    const r = buildMaintenanceReport(dir, fakeNpm)
    expect(r.security.length).toBeGreaterThan(0)
    expect(r.outdated.some(d => d.name === 'next')).toBe(true)
    expect(r.summary).toMatch(/Wartung/)
  })

  it('returns a safe report for a missing path', () => {
    const r = buildMaintenanceReport(join(dir, 'nope'), { outdated: () => '' })
    expect(r.summary).toMatch(/nicht gefunden/)
  })
})
