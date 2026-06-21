import { describe, expect, it } from 'vitest'
import { buildAutopilotReadiness, type AutopilotReadinessInputs } from './readiness'
import type { RunnerReadiness } from '@/lib/system/runner-readiness'

const readyRunner: RunnerReadiness = {
  ready: true,
  activeMode: 'claude-cli',
  zeroKeyReady: true,
  claude: {
    available: true,
    headlessReady: true,
    version: 'claude 1.0.0',
    detail: 'Claude CLI kann headless ohne API-Key Prompts ausfuehren.',
  },
  codex: {
    available: true,
    headlessReady: false,
    version: 'codex 1.0.0',
    detail: 'Codex CLI ist installiert. Headless-Prompt wurde noch nicht geprueft.',
  },
  claudeApiKeySet: false,
  openAiApiKeySet: false,
  recommendation: 'Echte Zero-Key-Ausfuehrung ist bereit. API-Keys bleiben optional.',
  checkedAt: '2026-05-28T10:00:00.000Z',
}

function baseInputs(overrides: Partial<AutopilotReadinessInputs> = {}): AutopilotReadinessInputs {
  return {
    runner: readyRunner,
    githubTokenSet: true,
    githubRepoConfigured: true,
    githubCli: { ok: true, value: 'gh version 2.0.0', detail: 'gh version 2.0.0' },
    githubAuth: { ok: true, value: 'Logged in', detail: 'Logged in' },
    git: { ok: true, value: 'git version 2.0.0', detail: 'git version 2.0.0' },
    gitRemote: { ok: true, value: 'git@github.com:owner/repo.git', detail: 'git@github.com:owner/repo.git' },
    gitBranch: { ok: true, value: 'feature/test', detail: 'feature/test' },
    gitStatus: { ok: true, value: '', detail: 'bereit' },
    scripts: {
      'type-check': 'tsc --noEmit',
      lint: 'next lint',
      build: 'next build',
      'test:run': 'vitest run',
    },
    ...overrides,
  }
}

describe('buildAutopilotReadiness', () => {
  it('marks autopilot ready when runner, git, github and validation are available', () => {
    const readiness = buildAutopilotReadiness(baseInputs())

    expect(readiness.status).toBe('attention')
    expect(readiness.canExecuteCode).toBe(true)
    expect(readiness.canCreatePr).toBe(true)
    expect(readiness.canAutoMerge).toBe(true)
    expect(readiness.score).toBeGreaterThanOrEqual(90)
  })

  it('blocks real app runs when no executable runner is available', () => {
    const readiness = buildAutopilotReadiness(baseInputs({
      runner: {
        ...readyRunner,
        ready: false,
        zeroKeyReady: false,
        activeMode: 'simulation',
        claude: { available: false, headlessReady: false, version: null, detail: 'claude CLI nicht im PATH gefunden.' },
        codex: { available: false, headlessReady: false, version: null, detail: 'codex CLI nicht im PATH gefunden.' },
        recommendation: 'Kein echter Runner bereit.',
      },
    }))

    expect(readiness.status).toBe('blocked')
    expect(readiness.canExecuteCode).toBe(false)
    expect(readiness.canStartDemoRun).toBe(false)
    expect(readiness.recommendation).toContain('noch nicht bereit')
  })

  it('keeps PR creation blocked without GitHub token or gh auth', () => {
    const readiness = buildAutopilotReadiness(baseInputs({
      githubTokenSet: false,
      githubCli: { ok: true, value: 'gh version 2.0.0', detail: 'gh version 2.0.0' },
      githubAuth: { ok: false, detail: 'not logged in' },
    }))

    expect(readiness.canCreatePr).toBe(false)
    expect(readiness.canAutoMerge).toBe(false)
    expect(readiness.checks.find(check => check.id === 'github-access')?.status).toBe('attention')
  })

  it('does not allow auto-merge with a dirty working tree', () => {
    const readiness = buildAutopilotReadiness(baseInputs({
      gitStatus: { ok: true, value: ' M src/app/live/page.tsx', detail: 'dirty' },
    }))

    expect(readiness.canCreatePr).toBe(true)
    expect(readiness.canAutoMerge).toBe(false)
    expect(readiness.checks.find(check => check.id === 'working-tree')?.status).toBe('attention')
  })
})
