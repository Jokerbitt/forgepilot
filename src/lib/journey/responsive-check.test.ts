import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { checkResponsive } from './responsive-check'

let dir: string
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'fp-resp-')) })
afterEach(() => { rmSync(dir, { recursive: true, force: true }) })

function write(rel: string, content: string) {
  const abs = join(dir, rel)
  mkdirSync(join(abs, '..'), { recursive: true })
  writeFileSync(abs, content)
}

describe('checkResponsive', () => {
  it('scores a responsive app high', () => {
    write('app/layout.tsx', '<meta name="viewport" content="width=device-width, initial-scale=1" />')
    write('app/page.tsx', '<div className="flex md:grid lg:gap-4">hi</div>')
    const r = checkResponsive(dir)
    expect(r.hasViewportMeta).toBe(true)
    expect(r.usesResponsiveClasses).toBe(true)
    expect(r.score).toBeGreaterThanOrEqual(80)
  })

  it('flags a non-responsive app with fixed widths', () => {
    write('src/page.tsx', '<div style={{ width: 1200 + "px" }}>x</div>')
    write('styles/main.css', '.box { width: 960px; }')
    const r = checkResponsive(dir)
    expect(r.usesResponsiveClasses).toBe(false)
    expect(r.fixedWidthHits).toBeGreaterThan(0)
    expect(r.score).toBeLessThan(50)
    expect(r.findings.some(f => f.includes('Viewport'))).toBe(true)
  })

  it('credits media queries even without tailwind classes', () => {
    write('app/layout.tsx', '<meta name="viewport" content="width=device-width" />')
    write('styles/app.css', '@media (max-width: 640px) { .x { display: none } }')
    const r = checkResponsive(dir)
    expect(r.usesMediaQueries).toBe(true)
    expect(r.score).toBeGreaterThanOrEqual(80)
  })

  it('returns a safe report for a missing path', () => {
    const r = checkResponsive(join(dir, 'nope'))
    expect(r.score).toBe(0)
    expect(r.summary).toMatch(/nicht gefunden/)
  })
})
