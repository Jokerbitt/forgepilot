import { describe, it, expect } from 'vitest'
import {
  lastOutputLines,
  parsePassedCount,
  formatBuildSuccessLog,
  formatTestSuccessLog,
  formatFailureLog,
} from './runner-log-summary'

describe('lastOutputLines', () => {
  it('returns the last n non-empty lines', () => {
    const out = 'a\nb\n\nc\nd\n'
    expect(lastOutputLines(out, 2)).toBe('c\nd')
  })

  it('drops blank lines before slicing', () => {
    const out = 'one\n\n\ntwo\n\nthree'
    expect(lastOutputLines(out, 3)).toBe('one\ntwo\nthree')
  })

  it('returns all lines when fewer than n exist', () => {
    expect(lastOutputLines('only', 5)).toBe('only')
  })

  it('returns empty string for empty input', () => {
    expect(lastOutputLines('', 3)).toBe('')
  })
})

describe('parsePassedCount', () => {
  it('parses a vitest summary line', () => {
    expect(parsePassedCount('Tests  42 passed (42)')).toBe(42)
  })

  it('parses a bare "N passed"', () => {
    expect(parsePassedCount('... 7 passed ...')).toBe(7)
  })

  it('returns null when no passed count is present', () => {
    expect(parsePassedCount('build complete')).toBeNull()
    expect(parsePassedCount('')).toBeNull()
  })
})

describe('formatBuildSuccessLog', () => {
  it('marks the build green and appends a short output tail', () => {
    const log = formatBuildSuccessLog('compiling\nlinking\nbuild done in 4s')
    expect(log).toContain('✅ Build grün.')
    expect(log).toContain('build done in 4s')
  })

  it('omits the tail when there is no output', () => {
    expect(formatBuildSuccessLog('')).toBe('✅ Build grün.')
  })
})

describe('formatTestSuccessLog', () => {
  it('includes the passed count when detectable', () => {
    const log = formatTestSuccessLog('Test Files 3 passed\nTests  42 passed (42)')
    expect(log).toContain('✅ Tests grün (42 passed).')
  })

  it('falls back to a generic green line when no count is found', () => {
    expect(formatTestSuccessLog('all good')).toContain('✅ Tests grün.')
  })
})

describe('formatFailureLog', () => {
  it('appends a tail of the raw output up to maxChars', () => {
    const out = 'x'.repeat(2000)
    const log = formatFailureLog('🔴 failed', out, 800)
    expect(log.startsWith('🔴 failed\n')).toBe(true)
    // label + newline + 800 chars
    expect(log.length).toBe('🔴 failed'.length + 1 + 800)
  })

  it('returns just the label when output is empty', () => {
    expect(formatFailureLog('🔴 failed', '')).toBe('🔴 failed')
  })
})
