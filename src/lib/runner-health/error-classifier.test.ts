import { describe, it, expect } from 'vitest'
import { classifyError, detectKnownError, extractErrorSnippet } from './error-classifier'

describe('classifyError', () => {
  it('classifies billing errors', () => {
    const result = classifyError('Your account has insufficient credit balance to complete this request.')
    expect(result.category).toBe('billing')
    expect(result.severity).toBe('critical')
    expect(result.title).toContain('Guthaben')
  })

  it('classifies invalid API key', () => {
    const result = classifyError('Error: invalid x-api-key provided')
    expect(result.category).toBe('auth')
    expect(result.title).toContain('API Key')
  })

  it('classifies Claude CLI not logged in', () => {
    const result = classifyError('Not logged in. Please run claude login to continue.')
    expect(result.category).toBe('auth')
    expect(result.title).toContain('nicht angemeldet')
  })

  it('classifies GitHub auth failure', () => {
    const result = classifyError('remote: HTTP 403: requires authentication: GitHub Token required')
    expect(result.category).toBe('auth')
    expect(result.title).toContain('GitHub')
  })

  it('classifies rate limit', () => {
    const result = classifyError('429 Too Many Requests: rate limit exceeded')
    expect(result.category).toBe('rate_limit')
    expect(result.severity).toBe('warning')
  })

  it('classifies Claude CLI not found', () => {
    const result = classifyError("spawn claude ENOENT: no such file or directory, 'claude'")
    expect(result.category).toBe('tool_missing')
    expect(result.title).toContain('Claude Code')
    expect(result.fix).toContain('npm install')
  })

  it('classifies git not found', () => {
    const result = classifyError("Error: command not found: git")
    expect(result.category).toBe('tool_missing')
    expect(result.title).toContain('git')
  })

  it('classifies DNS resolution failure', () => {
    const result = classifyError('Error: getaddrinfo ENOTFOUND api.anthropic.com')
    expect(result.category).toBe('network')
    expect(result.title).toContain('Netzwerk')
  })

  it('classifies merge conflict', () => {
    const result = classifyError('CONFLICT (content): Merge conflict in src/app/api/route.ts')
    expect(result.category).toBe('git')
    expect(result.title).toContain('Konflikt')
  })

  it('classifies TypeScript errors', () => {
    const result = classifyError("error TS2322: Type 'string' is not assignable to type 'number'")
    expect(result.category).toBe('build')
    expect(result.title).toContain('TypeScript')
  })

  it('classifies test failures', () => {
    const result = classifyError('FAIL src/lib/foo.test.ts\n5 tests failed')
    expect(result.category).toBe('test')
    expect(result.title).toContain('Tests')
  })

  it('classifies max turns reached', () => {
    const result = classifyError('Reached max turns (40). Stopping execution.')
    expect(result.category).toBe('budget')
    expect(result.title).toContain('Turn-Limit')
  })

  it('classifies OOM', () => {
    const result = classifyError('JavaScript heap out of memory — killed')
    expect(result.category).toBe('process')
    expect(result.title).toContain('Out of Memory')
  })

  it('returns unknown for unrecognized errors', () => {
    const result = classifyError('some completely unknown error xyz123')
    expect(result.category).toBe('unknown')
  })

  it('is case-insensitive', () => {
    const result = classifyError('CREDIT BALANCE IS ZERO')
    expect(result.category).toBe('billing')
  })

  it('handles empty string gracefully', () => {
    const result = classifyError('')
    expect(result.category).toBe('unknown')
  })
})

describe('detectKnownError', () => {
  it('returns undefined for unknown errors', () => {
    expect(detectKnownError('something random')).toBeUndefined()
  })

  it('returns title + fix string for known errors', () => {
    const result = detectKnownError('invalid x-api-key')
    expect(result).toBeDefined()
    expect(result).toContain('—')
  })
})

describe('extractErrorSnippet', () => {
  it('extracts error lines from mixed output', () => {
    const output = `
Starting agent...
Processing file src/app/api/route.ts
Writing changes...
Error: TypeScript error TS2322 in src/lib/model.ts
error: failed to compile
Done processing
    `.trim()
    const snippet = extractErrorSnippet(output, 5)
    expect(snippet).toContain('error')
    expect(snippet.split('\n').length).toBeLessThanOrEqual(5)
  })

  it('falls back to last N lines if no error lines found', () => {
    const output = 'line 1\nline 2\nline 3\nline 4\nline 5\nline 6'
    const snippet = extractErrorSnippet(output, 3)
    expect(snippet).toContain('line 6')
  })
})
