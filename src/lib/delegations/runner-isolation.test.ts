import { describe, it, expect } from 'vitest'
import { buildIsolatedTargetIntro, WORKSPACE_ISOLATION_RULE } from './runner-isolation'

describe('buildIsolatedTargetIntro', () => {
  const targetRepo = '/Users/sven/dev/myapp'

  it('names the target repo as context', () => {
    expect(buildIsolatedTargetIntro(targetRepo)).toContain(targetRepo)
  })

  it('directs the agent to work in the current directory', () => {
    const intro = buildIsolatedTargetIntro(targetRepo).toLowerCase()
    expect(intro).toContain('current working directory')
    expect(intro).toContain('isolated checkout')
  })

  it('explicitly forbids cd-ing to the original target repo', () => {
    const intro = buildIsolatedTargetIntro(targetRepo)
    expect(intro).toContain(`never \`cd\` to \`${targetRepo}\``)
  })

  it('warns that editing another copy bypasses the writeback', () => {
    expect(buildIsolatedTargetIntro(targetRepo).toLowerCase()).toContain('writeback')
  })

  it('still instructs reading the local CLAUDE.md / package.json for stack', () => {
    const intro = buildIsolatedTargetIntro(targetRepo)
    expect(intro).toContain('CLAUDE.md')
    expect(intro).toContain('package.json')
  })
})

describe('WORKSPACE_ISOLATION_RULE', () => {
  it('forbids leaving the workspace via cd', () => {
    const rule = WORKSPACE_ISOLATION_RULE.toLowerCase()
    expect(rule).toContain('cd')
    expect(rule).toContain('workspace')
    expect(rule).toContain('not written back')
  })
})
