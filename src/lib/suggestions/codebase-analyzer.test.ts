import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { analyzeCodebase, analysisToContext } from './codebase-analyzer'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'fp-analyze-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('analyzeCodebase', () => {
  it('detects stack, deps and source dirs from a Next.js + TS repo', () => {
    writeFileSync(join(dir, 'package.json'), JSON.stringify({
      name: 'demo-app',
      scripts: { test: 'vitest', build: 'next build' },
      dependencies: { next: '14', react: '18', zod: '3' },
      devDependencies: { typescript: '5', vitest: '1' },
    }))
    writeFileSync(join(dir, 'tsconfig.json'), '{}')
    writeFileSync(join(dir, 'README.md'), '# Demo')
    mkdirSync(join(dir, 'src'))
    writeFileSync(join(dir, 'src', 'foo.test.ts'), 'test')

    const a = analyzeCodebase(dir)
    expect(a.appName).toBe('demo-app')
    expect(a.stack).toContain('TypeScript')
    expect(a.stack).toContain('Next.js')
    expect(a.dependencies).toContain('zod')
    expect(a.dependencies).not.toContain('next') // framework already named in stack
    expect(a.sourceDirs).toContain('src')
    expect(a.hasTests).toBe(true)
    expect(a.hasTypeScript).toBe(true)
    expect(a.hasReadme).toBe(true)
  })

  it('flags missing tests, TS, CI and README as signals', () => {
    writeFileSync(join(dir, 'package.json'), JSON.stringify({
      name: 'bare',
      dependencies: { express: '4' },
    }))
    mkdirSync(join(dir, 'lib'))

    const a = analyzeCodebase(dir)
    expect(a.hasTypeScript).toBe(false)
    expect(a.hasTests).toBe(false)
    expect(a.stack).toContain('JavaScript')
    expect(a.stack).toContain('Express')
    expect(a.signals.some(s => s.includes('No TypeScript'))).toBe(true)
    expect(a.signals.some(s => s.includes('No tests'))).toBe(true)
    expect(a.signals.some(s => s.includes('No README'))).toBe(true)
  })

  it('returns a safe empty-ish analysis for a missing path', () => {
    const a = analyzeCodebase(join(dir, 'does-not-exist'))
    expect(a.stack).toEqual([])
    expect(a.sourceDirs).toEqual([])
    expect(a.signals.some(s => s.includes('not found'))).toBe(true)
  })

  it('falls back to the folder name when package.json has no name', () => {
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ dependencies: {} }))
    const a = analyzeCodebase(dir)
    expect(a.appName).toBe(dir.split('/').filter(Boolean).pop())
  })
})

describe('analysisToContext', () => {
  it('renders a compact grounding block', () => {
    writeFileSync(join(dir, 'package.json'), JSON.stringify({
      name: 'ctx-app',
      scripts: { test: 'vitest' },
      dependencies: { next: '14' },
      devDependencies: { typescript: '5' },
    }))
    writeFileSync(join(dir, 'tsconfig.json'), '{}')
    const text = analysisToContext(analyzeCodebase(dir))
    expect(text).toContain('App: ctx-app')
    expect(text).toContain('Stack:')
    expect(text).toContain('TypeScript: yes')
  })
})
