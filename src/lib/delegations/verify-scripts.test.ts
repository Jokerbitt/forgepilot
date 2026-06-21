import { describe, it, expect } from 'vitest'
import { resolveVerifyScripts, verifyCommand } from './verify-scripts'

describe('resolveVerifyScripts', () => {
  it('prefers test:run when present (ForgePilot convention)', () => {
    const r = resolveVerifyScripts({ build: 'next build', 'test:run': 'vitest run', test: 'vitest', lint: 'eslint', 'type-check': 'tsc --noEmit' })
    expect(r.test).toBe('test:run')
    expect(r.build).toBe('build')
    expect(r.lint).toBe('lint')
    expect(r.typeCheck).toBe('type-check')
  })

  it('falls back to test when there is no test:run (external repo like plantvault)', () => {
    const r = resolveVerifyScripts({ build: 'next build --turbopack', test: 'vitest run', lint: 'eslint', 'type-check': 'tsc --noEmit' })
    expect(r.test).toBe('test')
  })

  it('returns nulls for missing scripts', () => {
    expect(resolveVerifyScripts({})).toEqual({ build: null, test: null, lint: null, typeCheck: null })
    expect(resolveVerifyScripts(undefined)).toEqual({ build: null, test: null, lint: null, typeCheck: null })
  })

  it('ignores empty script values', () => {
    expect(resolveVerifyScripts({ test: '   ' }).test).toBeNull()
  })

  it('resolves typecheck variants', () => {
    expect(resolveVerifyScripts({ typecheck: 'tsc' }).typeCheck).toBe('typecheck')
  })
})

describe('verifyCommand', () => {
  it('joins the scripts a repo actually has', () => {
    expect(verifyCommand({ test: 'vitest run', lint: 'eslint', 'type-check': 'tsc --noEmit' }))
      .toBe('npm run test && npm run lint && npm run type-check')
  })

  it('uses test:run for ForgePilot', () => {
    expect(verifyCommand({ 'test:run': 'vitest run', lint: 'eslint', 'type-check': 'tsc --noEmit' }))
      .toBe('npm run test:run && npm run lint && npm run type-check')
  })

  it('falls back to build when no verify scripts exist', () => {
    expect(verifyCommand({ build: 'next build' })).toBe('npm run build')
    expect(verifyCommand({})).toBe('npm run build')
  })
})
