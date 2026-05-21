import { describe, it, expect } from 'vitest'
import { extractLinearIssueIds } from './client'

describe('extractLinearIssueIds', () => {
  it('extracts issue IDs from PR title', () => {
    const ids = extractLinearIssueIds('feat: implement FP-123 feature')
    expect(ids).toContain('FP-123')
  })

  it('extracts multiple IDs', () => {
    const ids = extractLinearIssueIds('Closes FP-1 and FP-2\nAlso fixes FORGE-99')
    expect(ids).toContain('FP-1')
    expect(ids).toContain('FP-2')
    expect(ids).toContain('FORGE-99')
  })

  it('deduplicates IDs', () => {
    const ids = extractLinearIssueIds('FP-1 and FP-1')
    expect(ids).toHaveLength(1)
  })

  it('returns empty array when no IDs found', () => {
    const ids = extractLinearIssueIds('No issue references here')
    expect(ids).toHaveLength(0)
  })
})
