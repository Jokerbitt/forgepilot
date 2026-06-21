import { describe, it, expect } from 'vitest'
import { findRelevantFiles, readProjectConfig, buildCodebaseContextBlock } from './codebase-scout'
import { join } from 'path'

const REPO_ROOT = join(process.cwd())

describe('readProjectConfig', () => {
  it('reads CLAUDE.md or AGENTS.md from this repo', () => {
    const cfg = readProjectConfig(REPO_ROOT)
    // ForgePilot has .claude/CLAUDE.md and AGENTS.md
    expect(cfg.claudeMd ?? cfg.agentsMd).toBeDefined()
  })

  it('reads test command from package.json', () => {
    const cfg = readProjectConfig(REPO_ROOT)
    expect(cfg.testCommand).toBeDefined()
  })

  it('reads tsconfig path aliases', () => {
    const cfg = readProjectConfig(REPO_ROOT)
    expect(cfg.tsconfigPaths).toContain('@/')
  })

  it('returns empty snapshot for non-existent directory', () => {
    const cfg = readProjectConfig('/non-existent-path-xyz')
    expect(cfg.claudeMd).toBeUndefined()
    expect(cfg.testCommand).toBeUndefined()
  })
})

describe('findRelevantFiles', () => {
  it('returns an array (may be empty) for any goal', () => {
    const files = findRelevantFiles('create delegation', '', REPO_ROOT, 3)
    expect(Array.isArray(files)).toBe(true)
  })

  it('finds files related to delegation model', () => {
    const files = findRelevantFiles('update the Delegation data model', 'delegation status', REPO_ROOT, 5)
    const paths = files.map(f => f.path)
    // At least one result should include 'delegation' in path or snippet
    expect(paths.some(p => p.toLowerCase().includes('delegation'))).toBe(true)
  })

  it('never returns test files', () => {
    const files = findRelevantFiles('delegation tests', '', REPO_ROOT, 10)
    const hasTestFiles = files.some(f => f.path.includes('.test.') || f.path.includes('.spec.'))
    expect(hasTestFiles).toBe(false)
  })

  it('returns max the requested number of files', () => {
    const files = findRelevantFiles('component hook model api', '', REPO_ROOT, 3)
    expect(files.length).toBeLessThanOrEqual(3)
  })
})

describe('buildCodebaseContextBlock', () => {
  it('returns a non-empty block for this repo', () => {
    const block = buildCodebaseContextBlock('build a new API route', '', REPO_ROOT)
    expect(block.length).toBeGreaterThan(50)
  })

  it('includes project conventions or agent briefing', () => {
    const block = buildCodebaseContextBlock('add a feature', '', REPO_ROOT)
    // Should contain either CLAUDE.md or AGENTS.md section header
    expect(block).toMatch(/CLAUDE\.md|AGENTS\.md/)
  })
})
