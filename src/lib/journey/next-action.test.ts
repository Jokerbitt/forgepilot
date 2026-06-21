import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { suggestNextActions } from './next-action'

let dir: string
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'fp-next-')) })
afterEach(() => { rmSync(dir, { recursive: true, force: true }) })

function write(rel: string, content: string) {
  const abs = join(dir, rel)
  mkdirSync(join(abs, '..'), { recursive: true })
  writeFileSync(abs, content)
}

describe('suggestNextActions', () => {
  it('puts security and tests first for a risky app', () => {
    write('package.json', JSON.stringify({ name: 'app', dependencies: {} }))
    write('src/db.ts', 'const cs = "Server=x;Password=secret123;"')
    const actions = suggestNextActions(dir)
    expect(actions[0]!.priority).toBe('high')
    expect(actions.some(a => a.title.includes('Sicherheits'))).toBe(true)
    expect(actions.some(a => a.title.includes('Tests'))).toBe(true)
  })

  it('recommends going live when the basics are covered', () => {
    write('package.json', JSON.stringify({ name: 'app', scripts: { test: 'vitest' } }))
    write('README.md', '# App')
    write('.github/workflows/ci.yml', 'name: ci')
    write('app/layout.tsx', '<meta name="viewport" content="width=device-width" /><div className="md:flex" />')
    const actions = suggestNextActions(dir)
    expect(actions.some(a => a.title.includes('live'))).toBe(true)
  })

  it('handles a missing path', () => {
    expect(suggestNextActions(join(dir, 'nope'))[0]!.title).toMatch(/Pfad/)
  })
})
