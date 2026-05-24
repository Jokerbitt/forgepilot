/**
 * Tests for getOnboardingStatus() and detectHasCLIProvider()
 */

import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let tmpDir: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fp-onboarding-'))
  vi.resetModules()
  for (const key of ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'GOOGLE_API_KEY', 'GROQ_API_KEY', 'MISTRAL_API_KEY', 'TOGETHER_API_KEY']) {
    delete process.env[key]
  }
})

afterEach(() => {
  vi.restoreAllMocks()
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

/**
 * @param dataDir - tmp dir for config files
 * @param cliProviders - list of binary names that should appear as "installed"
 */
async function makeStatus(dataDir: string, cliProviders: string[] = []) {
  vi.doMock('@/lib/config/paths', () => ({
    getConfigPath: (filename: string) => path.join(dataDir, filename),
  }))
  vi.doMock('child_process', () => ({
    execFileSync: vi.fn((_cmd: string, args: string[]) => {
      const binary = args[0] as string
      if (cliProviders.includes(binary)) return `/usr/local/bin/${binary}\n`
      throw new Error(`${binary}: not found`)
    }),
  }))
  const { getOnboardingStatus, detectHasCLIProvider } = await import('@/lib/onboarding/status')
  return { getOnboardingStatus, detectHasCLIProvider }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('detectHasCLIProvider()', () => {
  it('returns false when neither claude nor codex is installed', async () => {
    const { detectHasCLIProvider } = await makeStatus(tmpDir, [])
    expect(detectHasCLIProvider()).toBe(false)
  })

  it('returns true when claude CLI is installed', async () => {
    const { detectHasCLIProvider } = await makeStatus(tmpDir, ['claude'])
    expect(detectHasCLIProvider()).toBe(true)
  })

  it('returns true when codex CLI is installed', async () => {
    const { detectHasCLIProvider } = await makeStatus(tmpDir, ['codex'])
    expect(detectHasCLIProvider()).toBe(true)
  })
})

describe('getOnboardingStatus()', () => {
  it('returns all false when config files are missing and no CLI providers', async () => {
    const { getOnboardingStatus } = await makeStatus(tmpDir, [])
    const status = getOnboardingStatus()

    expect(status.hasProvider).toBe(false)
    expect(status.hasCLIProvider).toBe(false)
    expect(status.hasIdea).toBe(false)
    expect(status.hasDelegation).toBe(false)
    expect(status.isComplete).toBe(false)
    expect(status.completedSteps).toBe(0)
    expect(status.totalSteps).toBe(3)
  })

  it('hasProvider and hasCLIProvider are true when claude CLI is installed', async () => {
    const { getOnboardingStatus } = await makeStatus(tmpDir, ['claude'])
    const status = getOnboardingStatus()

    expect(status.hasCLIProvider).toBe(true)
    expect(status.hasProvider).toBe(true)
    expect(status.completedSteps).toBe(1)
  })

  it('hasProvider is true when api-key is found in api-keys.json', async () => {
    fs.writeFileSync(
      path.join(tmpDir, 'api-keys.json'),
      JSON.stringify({ ANTHROPIC_API_KEY: 'sk-ant-test-key-123' }),
    )
    const { getOnboardingStatus } = await makeStatus(tmpDir, [])
    const status = getOnboardingStatus()

    expect(status.hasProvider).toBe(true)
  })

  it('hasProvider is true when apiKey found in ai-providers.json providerOverrides', async () => {
    fs.writeFileSync(
      path.join(tmpDir, 'ai-providers.json'),
      JSON.stringify({
        providerOverrides: [{ id: 'anthropic', apiKey: 'sk-ant-override-key', enabled: true }],
        customProviders: [],
        modelSelection: {},
      }),
    )
    const { getOnboardingStatus } = await makeStatus(tmpDir, [])
    const status = getOnboardingStatus()

    expect(status.hasProvider).toBe(true)
  })

  it('hasIdea is true when idea-history.json has entries', async () => {
    fs.writeFileSync(
      path.join(tmpDir, 'idea-history.json'),
      JSON.stringify([{ id: 'idea-1', idea: 'Test idea', createdAt: '2026-01-01T00:00:00Z' }]),
    )
    const { getOnboardingStatus } = await makeStatus(tmpDir, [])
    const status = getOnboardingStatus()

    expect(status.hasIdea).toBe(true)
  })

  it('hasDelegation is true when delegations.json has entries', async () => {
    fs.writeFileSync(
      path.join(tmpDir, 'delegations.json'),
      JSON.stringify([{ id: 'del-1', title: 'Test delegation', status: 'pending' }]),
    )
    const { getOnboardingStatus } = await makeStatus(tmpDir, [])
    const status = getOnboardingStatus()

    expect(status.hasDelegation).toBe(true)
  })

  it('isComplete is true only when all 3 steps are done', async () => {
    fs.writeFileSync(
      path.join(tmpDir, 'api-keys.json'),
      JSON.stringify({ ANTHROPIC_API_KEY: 'sk-ant-key' }),
    )
    fs.writeFileSync(
      path.join(tmpDir, 'idea-history.json'),
      JSON.stringify([{ id: 'idea-1', idea: 'My idea' }]),
    )
    fs.writeFileSync(
      path.join(tmpDir, 'delegations.json'),
      JSON.stringify([{ id: 'del-1', title: 'My delegation' }]),
    )
    const { getOnboardingStatus } = await makeStatus(tmpDir, [])
    const status = getOnboardingStatus()

    expect(status.hasProvider).toBe(true)
    expect(status.hasIdea).toBe(true)
    expect(status.hasDelegation).toBe(true)
    expect(status.isComplete).toBe(true)
    expect(status.completedSteps).toBe(3)
  })

  it('completedSteps increments correctly for each completed step', async () => {
    // Only idea done
    fs.writeFileSync(
      path.join(tmpDir, 'idea-history.json'),
      JSON.stringify([{ id: 'idea-1' }]),
    )
    const { getOnboardingStatus } = await makeStatus(tmpDir, [])
    const status = getOnboardingStatus()

    expect(status.completedSteps).toBe(1)
    expect(status.hasIdea).toBe(true)
    expect(status.hasProvider).toBe(false)
    expect(status.hasDelegation).toBe(false)
  })

  it('hasProvider is false when api-keys.json has empty string values', async () => {
    fs.writeFileSync(
      path.join(tmpDir, 'api-keys.json'),
      JSON.stringify({ ANTHROPIC_API_KEY: '', OPENAI_API_KEY: '   ' }),
    )
    const { getOnboardingStatus } = await makeStatus(tmpDir, [])
    const status = getOnboardingStatus()

    expect(status.hasProvider).toBe(false)
  })

  it('handles malformed JSON files gracefully', async () => {
    fs.writeFileSync(path.join(tmpDir, 'idea-history.json'), 'not-valid-json{')
    fs.writeFileSync(path.join(tmpDir, 'delegations.json'), '{ broken')
    const { getOnboardingStatus } = await makeStatus(tmpDir, [])
    const status = getOnboardingStatus()

    expect(status.hasIdea).toBe(false)
    expect(status.hasDelegation).toBe(false)
  })
})
