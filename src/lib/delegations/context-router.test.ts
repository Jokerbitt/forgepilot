import { describe, it, expect, vi } from 'vitest'
import type { TaskContract } from '@/lib/models/delegation'
import { resolveContextProfile, buildSelectiveContext } from './context-router'

// Helper: cast a raw string to TaskType so tests can exercise the lowercase-matching logic
// without being constrained to only the declared TaskType literals.
function asContract(taskType?: string, skillCategory?: TaskContract['skillCategory']): Pick<TaskContract, 'taskType' | 'skillCategory'> {
  return { taskType: taskType as TaskContract['taskType'], skillCategory }
}

// Mock dependencies so tests run without filesystem access
vi.mock('./knowledge-packages', () => ({
  buildKnowledgeBlock: (_goal: string, _context: string, _skill?: string) =>
    `knowledge-block-${_skill ?? 'default'}`,
}))

vi.mock('./codebase-scout', () => ({
  buildCodebaseContextBlock: (_goal: string, _context: string, _repo: string) =>
    `codebase-block-${_repo}`,
}))

vi.mock('@/lib/delegation-execution', () => ({
  buildSkillBlock: (_skill?: string, _patterns?: string[]) =>
    `skill-block-${_skill ?? 'default'}`,
}))

describe('resolveContextProfile', () => {
  it('returns "test" for taskType="test"', () => {
    expect(resolveContextProfile(asContract('test'))).toBe('test')
  })

  it('returns "test" for skillCategory="test"', () => {
    expect(resolveContextProfile(asContract(undefined, 'test'))).toBe('test')
  })

  it('returns "bug-fix" for taskType="bug-fix"', () => {
    expect(resolveContextProfile(asContract('bug-fix'))).toBe('bug-fix')
  })

  it('returns "bug-fix" for taskType="bug"', () => {
    expect(resolveContextProfile(asContract('bug'))).toBe('bug-fix')
  })

  it('returns "bug-fix" for taskType="fix"', () => {
    expect(resolveContextProfile(asContract('fix'))).toBe('bug-fix')
  })

  it('returns "feature" as fallback for unknown taskType', () => {
    expect(resolveContextProfile(asContract('unknown-xyz'))).toBe('feature')
  })

  it('returns "feature" as fallback when taskType and skillCategory are undefined', () => {
    expect(resolveContextProfile(asContract())).toBe('feature')
  })

  it('returns "ui-component" for skillCategory="ui-component"', () => {
    expect(resolveContextProfile(asContract(undefined, 'ui-component'))).toBe('ui-component')
  })

  it('returns "refactor" for skillCategory="refactor"', () => {
    expect(resolveContextProfile(asContract(undefined, 'refactor'))).toBe('refactor')
  })

  it('returns "docs" for taskType="documentation"', () => {
    expect(resolveContextProfile(asContract('documentation'))).toBe('docs')
  })

  it('returns "infra" for taskType="infrastructure"', () => {
    expect(resolveContextProfile(asContract('infrastructure'))).toBe('infra')
  })
})

describe('buildSelectiveContext', () => {
  const baseContract = {
    goal: 'add a new feature',
    context: 'some context',
    allowedFilePatterns: ['src/**/*.ts'],
  }

  function contractWith(taskType: string) {
    return { ...baseContract, taskType: taskType as TaskContract['taskType'] }
  }

  it('returns empty strings for "review" profile (no skill, no knowledge, no codebase)', () => {
    const result = buildSelectiveContext(contractWith('review'))
    expect(result.skillBlock).toBe('')
    expect(result.knowledgeBlock).toBe('')
    expect(result.codebaseBlock).toBe('')
    expect(result.profile).toBe('review')
  })

  it('returns estimatedTokens >= 0', () => {
    const result = buildSelectiveContext(contractWith('feature'), '/some/repo')
    expect(result.estimatedTokens).toBeGreaterThanOrEqual(0)
  })

  it('skips knowledgeBlock for "test" profile', () => {
    const result = buildSelectiveContext(contractWith('test'), '/some/repo')
    expect(result.profile).toBe('test')
    expect(result.knowledgeBlock).toBe('')
    // skill block should be present for test profile
    expect(result.skillBlock).not.toBe('')
  })

  it('skips knowledgeBlock for "bug-fix" profile', () => {
    const result = buildSelectiveContext(contractWith('bug-fix'))
    expect(result.knowledgeBlock).toBe('')
    expect(result.skillBlock).not.toBe('')
  })

  it('includes all blocks for "feature" profile when targetRepo provided', () => {
    const result = buildSelectiveContext(contractWith('feature'), '/my/repo')
    expect(result.skillBlock).not.toBe('')
    expect(result.knowledgeBlock).not.toBe('')
    expect(result.codebaseBlock).not.toBe('')
    expect(result.profile).toBe('feature')
  })

  it('skips codebaseBlock when targetRepo is not provided even for feature profile', () => {
    const result = buildSelectiveContext(contractWith('feature'))
    expect(result.codebaseBlock).toBe('')
  })

  it('returns correct profile in result', () => {
    const result = buildSelectiveContext(contractWith('test'))
    expect(result.profile).toBe('test')
  })

  it('estimatedTokens is sum of block lengths / 4 (rounded up)', () => {
    const result = buildSelectiveContext(contractWith('review'))
    // All blocks are empty for review
    expect(result.estimatedTokens).toBe(0)
  })
})
