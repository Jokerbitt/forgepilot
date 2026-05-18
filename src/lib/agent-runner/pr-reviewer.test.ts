import { describe, it, expect, vi, beforeEach } from 'vitest'
import { runPRReview } from './pr-reviewer'

// Mock fs and child_process to avoid real system calls in tests
vi.mock('child_process', () => ({
  spawnSync: vi.fn(),
  execSync: vi.fn(),
}))

vi.mock('@/lib/attention/store', () => ({
  upsertAttentionItem: vi.fn(),
}))

import { spawnSync } from 'child_process'
import { upsertAttentionItem } from '@/lib/attention/store'

const mockSpawnSync = vi.mocked(spawnSync)
const mockUpsert = vi.mocked(upsertAttentionItem)

function makeSpawnResult(stdout: string, status = 0) {
  return { stdout, stderr: '', status, pid: 1, signal: null, output: [] }
}

const passingPRInfo = JSON.stringify({
  title: 'feat: add new feature',
  url: 'https://github.com/owner/repo/pull/42',
  body: '## Summary\n- Added new feature',
})

const passingFiles = 'src/lib/new-feature.ts\nsrc/lib/new-feature.test.ts\n'
const passingDiff = '--- a/src/lib/new-feature.ts\n+++ b/src/lib/new-feature.ts\n+export function newFeature() { return true }\n'
const passingTests = 'Test Files  5 passed (5)\n      Tests  42 passed (42)\n'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('runPRReview', () => {
  it('passes when all quality checks succeed', async () => {
    // gh pr view, gh pr diff --name-only, gh pr diff, test, lint, type-check
    mockSpawnSync
      .mockReturnValueOnce(makeSpawnResult(passingPRInfo))        // gh pr view
      .mockReturnValueOnce(makeSpawnResult(passingFiles))          // gh pr diff --name-only
      .mockReturnValueOnce(makeSpawnResult(passingDiff))           // gh pr diff
      .mockReturnValueOnce(makeSpawnResult(passingTests))          // npm test
      .mockReturnValueOnce(makeSpawnResult('No ESLint warnings or errors'))  // lint
      .mockReturnValueOnce(makeSpawnResult(''))                    // type-check

    const result = await runPRReview({ prNumber: 42, ghToken: 'ghp_test' })

    expect(result.passed).toBe(true)
    expect(result.prNumber).toBe(42)
    expect(result.findings.filter(f => f.severity === 'critical')).toHaveLength(0)
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'review_passed' })
    )
  })

  it('fails with critical finding when tests fail', async () => {
    mockSpawnSync
      .mockReturnValueOnce(makeSpawnResult(passingPRInfo))
      .mockReturnValueOnce(makeSpawnResult(passingFiles))
      .mockReturnValueOnce(makeSpawnResult(passingDiff))
      .mockReturnValueOnce(makeSpawnResult('Tests 2 failed', 1))   // failing tests
      .mockReturnValueOnce(makeSpawnResult('No ESLint warnings or errors'))
      .mockReturnValueOnce(makeSpawnResult(''))

    const result = await runPRReview({ prNumber: 42, ghToken: 'ghp_test' })

    expect(result.passed).toBe(false)
    const criticals = result.findings.filter(f => f.severity === 'critical' && f.category === 'tests')
    expect(criticals).toHaveLength(1)
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'review_failed', severity: 'critical' })
    )
  })

  it('detects secrets in diff', async () => {
    const diffWithSecret = passingDiff + '+const key = "sk-ant-api03-secretkey12345678901234567890";\n'
    mockSpawnSync
      .mockReturnValueOnce(makeSpawnResult(passingPRInfo))
      .mockReturnValueOnce(makeSpawnResult(passingFiles))
      .mockReturnValueOnce(makeSpawnResult(diffWithSecret))
      .mockReturnValueOnce(makeSpawnResult(passingTests))
      .mockReturnValueOnce(makeSpawnResult('No ESLint warnings or errors'))
      .mockReturnValueOnce(makeSpawnResult(''))

    const result = await runPRReview({ prNumber: 42, ghToken: 'ghp_test' })

    expect(result.passed).toBe(false)
    const secretFinding = result.findings.find(f => f.category === 'security')
    expect(secretFinding).toBeDefined()
    expect(secretFinding?.severity).toBe('critical')
  })

  it('detects config scope violations', async () => {
    const filesWithConfig = 'src/lib/feature.ts\nsrc/lib/feature.test.ts\nconfig/api-keys.json\n'
    mockSpawnSync
      .mockReturnValueOnce(makeSpawnResult(passingPRInfo))
      .mockReturnValueOnce(makeSpawnResult(filesWithConfig))
      .mockReturnValueOnce(makeSpawnResult(passingDiff))
      .mockReturnValueOnce(makeSpawnResult(passingTests))
      .mockReturnValueOnce(makeSpawnResult('No ESLint warnings or errors'))
      .mockReturnValueOnce(makeSpawnResult(''))

    const result = await runPRReview({ prNumber: 42, ghToken: 'ghp_test' })

    expect(result.scopeViolations).toContain('config/api-keys.json')
    expect(result.findings.find(f => f.category === 'scope')).toBeDefined()
  })

  it('warns when source files changed but no test files present', async () => {
    const filesNoTests = 'src/lib/feature.ts\nsrc/components/NewComponent.tsx\n'
    mockSpawnSync
      .mockReturnValueOnce(makeSpawnResult(passingPRInfo))
      .mockReturnValueOnce(makeSpawnResult(filesNoTests))
      .mockReturnValueOnce(makeSpawnResult(passingDiff))
      .mockReturnValueOnce(makeSpawnResult(passingTests))
      .mockReturnValueOnce(makeSpawnResult('No ESLint warnings or errors'))
      .mockReturnValueOnce(makeSpawnResult(''))

    const result = await runPRReview({ prNumber: 42, ghToken: 'ghp_test' })

    const noTestWarning = result.findings.find(f => f.category === 'tests' && f.severity === 'warning')
    expect(noTestWarning).toBeDefined()
  })

  it('flags files outside expected scope as info finding', async () => {
    mockSpawnSync
      .mockReturnValueOnce(makeSpawnResult(passingPRInfo))
      .mockReturnValueOnce(makeSpawnResult(passingFiles))
      .mockReturnValueOnce(makeSpawnResult(passingDiff))
      .mockReturnValueOnce(makeSpawnResult(passingTests))
      .mockReturnValueOnce(makeSpawnResult('No ESLint warnings or errors'))
      .mockReturnValueOnce(makeSpawnResult(''))

    const result = await runPRReview({
      prNumber: 42,
      ghToken: 'ghp_test',
      expectedScope: ['src/app/api/'],  // files are in src/lib/ — outside scope
    })

    const scopeFinding = result.findings.find(f => f.category === 'scope' && f.severity === 'info')
    expect(scopeFinding).toBeDefined()
  })
})
