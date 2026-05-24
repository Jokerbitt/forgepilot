import { describe, it, expect } from 'vitest'
import { classifyError, classifyErrorSummary } from './error-classifier'

describe('classifyError', () => {
  it('classifies missing provider errors', () => {
    const cases = [
      'No AI provider available',
      'NoAIProviderError: cannot generate text',
      'API key not set for anthropic',
      'Provider not configured',
      'Missing API key for openai',
    ]
    for (const msg of cases) {
      const result = classifyError(msg)
      expect(result.class, msg).toBe('provider-missing')
      expect(result.severity).toBe('blocking')
      expect(result.actionHref).toBe('/settings#ai-provider')
    }
  })

  it('classifies local model offline errors', () => {
    const cases = [
      'ECONNREFUSED 127.0.0.1:11434',
      'Failed to connect to local model',
      'Ollama server not reachable',
      'LM Studio connection refused',
    ]
    for (const msg of cases) {
      expect(classifyError(msg).class, msg).toBe('provider-offline')
    }
  })

  it('classifies turn limit errors', () => {
    const cases = [
      'Turn limit exceeded after 10 steps',
      'max_turns reached',
      'Maximum turns exceeded',
    ]
    for (const msg of cases) {
      expect(classifyError(msg).class, msg).toBe('turn-limit')
    }
  })

  it('classifies auth failures', () => {
    const cases = [
      'HTTP 401 Unauthorized',
      '403 Forbidden',
      'Authentication failed',
      'Invalid token',
      'Bad credentials',
    ]
    for (const msg of cases) {
      expect(classifyError(msg).class, msg).toBe('auth-failed')
      expect(classifyError(msg).severity).toBe('blocking')
    }
  })

  it('classifies GitHub PR errors', () => {
    const cases = [
      'GitHub PR creation failed',
      'Push rejected by remote',
      'Pull request failed: branch exists',
      'Merge conflict detected',
    ]
    for (const msg of cases) {
      expect(classifyError(msg).class, msg).toBe('github-pr-failed')
    }
  })

  it('classifies Linear sync errors', () => {
    expect(classifyError('Linear error: could not update issue').class).toBe('linear-sync-failed')
    expect(classifyError('Could not update Linear ticket').class).toBe('linear-sync-failed')
  })

  it('classifies test failures', () => {
    const cases = [
      '3 tests failed',
      'vitest: 5 test errors',
      'npm test fail',
      'Tests red after execution',
    ]
    for (const msg of cases) {
      expect(classifyError(msg).class, msg).toBe('tests-red')
    }
  })

  it('classifies scope conflicts', () => {
    expect(classifyError('Scope conflict: write scope locked by another agent').class).toBe('scope-conflict')
    expect(classifyError('Write scope already locked').class).toBe('scope-conflict')
  })

  it('classifies budget exceeded', () => {
    expect(classifyError('Budget exceeded: cost limit of $2 reached').class).toBe('budget-exceeded')
    expect(classifyError('Max budget exceeded').class).toBe('budget-exceeded')
  })

  it('classifies timeout errors', () => {
    expect(classifyError('Execution timed out after 300s').class).toBe('timeout')
    expect(classifyError('Request timed out').class).toBe('timeout')
  })

  it('returns unknown for unrecognized messages', () => {
    const result = classifyError('Something completely unexpected happened')
    expect(result.class).toBe('unknown')
    expect(result.severity).toBe('warning')
  })

  it('returns unknown for empty string', () => {
    expect(classifyError('').class).toBe('unknown')
    expect(classifyError('  ').class).toBe('unknown')
  })

  it('includes German title and nextAction for all classes', () => {
    const allMessages = [
      'No AI provider',
      'ECONNREFUSED 127.0.0.1:11434',
      'max_turns exceeded',
      'Request timed out',
      '401 Unauthorized',
      'GitHub PR failed',
      'Linear sync error',
      '3 tests failed',
      'scope conflict',
      'budget exceeded',
      'completely unknown error xyz',
    ]
    for (const msg of allMessages) {
      const result = classifyError(msg)
      expect(result.title.length, msg).toBeGreaterThan(0)
      expect(result.nextAction.length, msg).toBeGreaterThan(0)
      expect(result.cause.length, msg).toBeGreaterThan(0)
    }
  })
})

describe('classifyErrorSummary', () => {
  it('returns class, title, nextAction, severity only', () => {
    const result = classifyErrorSummary('No AI provider available')
    expect(Object.keys(result).sort()).toEqual(['class', 'nextAction', 'severity', 'title'].sort())
    expect(result.class).toBe('provider-missing')
  })
})
