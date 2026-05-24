import { describe, it, expect } from 'vitest'
import { scoreKnowledgeContent, shouldWriteCard } from './quality-gate'

describe('scoreKnowledgeContent', () => {
  it('passes high-quality content with bullets and a specific title', () => {
    const result = scoreKnowledgeContent(
      'Delegation: Fix TypeScript errors in auth module',
      '- Resolved 3 type errors in `auth/session.ts`\n- Added missing `userId` type guard\n- All existing tests still pass',
    )
    expect(result.pass).toBe(true)
    expect(result.score).toBeGreaterThanOrEqual(50)
  })

  it('fails very short content', () => {
    const result = scoreKnowledgeContent('Title', 'Too short')
    expect(result.pass).toBe(false)
    expect(result.reasons.some(r => r.includes('short'))).toBe(true)
  })

  it('fails content without bullet points', () => {
    const content = 'The delegation ran successfully and fixed all the issues that were present in the codebase. Everything works now.'
    const result = scoreKnowledgeContent('Some meaningful title for the work', content)
    expect(result.reasons.some(r => r.toLowerCase().includes('bullet'))).toBe(true)
  })

  it('fails on generic fallback title', () => {
    const content = '- First bullet\n- Second bullet\n- Third bullet here too'
    const result = scoreKnowledgeContent('Raw execution output (LLM summary unavailable):', content)
    expect(result.reasons.some(r => r.includes('generic'))).toBe(true)
  })

  it('gives higher score for longer content', () => {
    const shortBullets = scoreKnowledgeContent(
      'Good title for test',
      '- Short bullet\n- Another one',
    )
    const longBullets = scoreKnowledgeContent(
      'Good title for test',
      '- Fixed a critical bug in the authentication flow that caused tokens to expire prematurely\n' +
      '- Refactored session handling to use a more robust refresh mechanism\n' +
      '- Added comprehensive unit tests covering edge cases\n' +
      '- Updated documentation to reflect the new behavior',
    )
    expect(longBullets.score).toBeGreaterThanOrEqual(shortBullets.score)
  })
})

describe('shouldWriteCard', () => {
  const goodTitle   = 'Implement user profile photo upload'
  const goodContent = '- Added S3 upload endpoint with presigned URLs\n- Validated file types server-side (jpg, png only)\n- Added progress indicator to the upload form'

  it('allows a new card with good content and no existing sourceId', () => {
    const result = shouldWriteCard(goodTitle, goodContent, [], 'del-new')
    expect(result.allow).toBe(true)
    expect(result.qualityScore).toBeGreaterThanOrEqual(50)
  })

  it('blocks duplicate cards for the same sourceId', () => {
    const result = shouldWriteCard(goodTitle, goodContent, ['del-abc', 'del-xyz'], 'del-abc')
    expect(result.allow).toBe(false)
    expect(result.reason).toContain('duplicate')
    expect(result.qualityScore).toBe(0)
  })

  it('blocks low-quality content even for a new delegation', () => {
    const result = shouldWriteCard('Title', 'Too short', [], 'del-new-2')
    expect(result.allow).toBe(false)
    expect(result.qualityScore).toBeLessThan(50)
  })
})
