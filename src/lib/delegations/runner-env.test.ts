import { describe, it, expect } from 'vitest'
import { buildRunnerBaseEnv, isSecretEnvName, resolveRunnerTimeoutMs, DEFAULT_RUNNER_TIMEOUT_MS } from './runner-env'

describe('buildRunnerBaseEnv', () => {
  const parent = {
    NODE_ENV: 'development',
    ANTHROPIC_API_KEY: 'sk-ant-credit-less',
    OPENAI_API_KEY: 'sk-openai',
    CLAUDE_CODE_OAUTH_TOKEN: 'sk-ant-oat01-secret',
    GH_TOKEN: 'ghp_secret',
    GITHUB_TOKEN: 'ghp_secret2',
    CRON_SECRET: 'cron-secret',
    AUTH_SECRET: 'auth-secret',
    AUDIT_SECRET: 'audit-secret',
    DATABASE_URL: 'postgres://user:pw@host/db',
    ENCRYPTION_KEY: 'enc-key',
    PATH: '/usr/bin',
    HOME: '/home/forge',
    USER: 'forge',
    SHELL: '/bin/zsh',
    LANG: 'en_US.UTF-8',
    FORGEPILOT_RUNNER_TIMEOUT_MS: '600000',
  } as unknown as NodeJS.ProcessEnv

  it('drops NODE_ENV so target tooling picks its own (next build → production)', () => {
    const env = buildRunnerBaseEnv(parent)
    expect('NODE_ENV' in env).toBe(false)
    expect(env.NODE_ENV).toBeUndefined()
  })

  it('scrubs BOTH provider API keys (agent uses its own session auth)', () => {
    const env = buildRunnerBaseEnv(parent)
    expect('ANTHROPIC_API_KEY' in env).toBe(false)
    expect('OPENAI_API_KEY' in env).toBe(false)
  })

  it('scrubs the OAuth token and GitHub tokens (caller re-injects only what is needed)', () => {
    const env = buildRunnerBaseEnv(parent)
    expect('CLAUDE_CODE_OAUTH_TOKEN' in env).toBe(false)
    expect('GH_TOKEN' in env).toBe(false)
    expect('GITHUB_TOKEN' in env).toBe(false)
  })

  it('scrubs ForgePilot server secrets so they never reach the agent', () => {
    const env = buildRunnerBaseEnv(parent)
    expect('CRON_SECRET' in env).toBe(false)
    expect('AUTH_SECRET' in env).toBe(false)
    expect('AUDIT_SECRET' in env).toBe(false)
    expect('DATABASE_URL' in env).toBe(false)
    expect('ENCRYPTION_KEY' in env).toBe(false)
  })

  it('preserves the system + non-secret vars the runner needs to build/test', () => {
    const env = buildRunnerBaseEnv(parent)
    expect(env.PATH).toBe('/usr/bin')
    expect(env.HOME).toBe('/home/forge')
    expect(env.USER).toBe('forge')
    expect(env.SHELL).toBe('/bin/zsh')
    expect(env.LANG).toBe('en_US.UTF-8')
    expect(env.FORGEPILOT_RUNNER_TIMEOUT_MS).toBe('600000')
  })

  it('does not mutate the parent env', () => {
    buildRunnerBaseEnv(parent)
    expect(parent.NODE_ENV).toBe('development')
    expect(parent.ANTHROPIC_API_KEY).toBe('sk-ant-credit-less')
    expect(parent.CRON_SECRET).toBe('cron-secret')
  })
})

describe('isSecretEnvName', () => {
  it('flags credential-shaped names', () => {
    for (const name of [
      'ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'CLAUDE_CODE_OAUTH_TOKEN',
      'GH_TOKEN', 'GITHUB_TOKEN', 'CRON_SECRET', 'AUTH_SECRET', 'AUDIT_SECRET',
      'DATABASE_URL', 'ENCRYPTION_KEY', 'AWS_SECRET_ACCESS_KEY', 'MY_PASSWORD',
      'STRIPE_PRIVATE_KEY', 'SOME_CREDENTIAL', 'SENTRY_DSN',
    ]) {
      expect(isSecretEnvName(name), name).toBe(true)
    }
  })

  it('does not flag ordinary system / config vars', () => {
    for (const name of ['PATH', 'HOME', 'USER', 'SHELL', 'LANG', 'PWD', 'TMPDIR', 'FORGEPILOT_RUNNER_TIMEOUT_MS', 'CI', 'TERM']) {
      expect(isSecretEnvName(name), name).toBe(false)
    }
  })
})

describe('resolveRunnerTimeoutMs', () => {
  it('returns the 30-minute default when the env var is unset', () => {
    expect(resolveRunnerTimeoutMs({} as NodeJS.ProcessEnv)).toBe(DEFAULT_RUNNER_TIMEOUT_MS)
    expect(DEFAULT_RUNNER_TIMEOUT_MS).toBe(1_800_000)
  })

  it('honors a valid override', () => {
    const env = { FORGEPILOT_RUNNER_TIMEOUT_MS: '600000' } as unknown as NodeJS.ProcessEnv
    expect(resolveRunnerTimeoutMs(env)).toBe(600_000)
  })

  it('trims surrounding whitespace', () => {
    const env = { FORGEPILOT_RUNNER_TIMEOUT_MS: '  900000  ' } as unknown as NodeJS.ProcessEnv
    expect(resolveRunnerTimeoutMs(env)).toBe(900_000)
  })

  it('floors a value below the 60s minimum to the minimum', () => {
    const env = { FORGEPILOT_RUNNER_TIMEOUT_MS: '5000' } as unknown as NodeJS.ProcessEnv
    expect(resolveRunnerTimeoutMs(env)).toBe(60_000)
  })

  it('falls back to the default for a non-numeric value', () => {
    const env = { FORGEPILOT_RUNNER_TIMEOUT_MS: 'soon' } as unknown as NodeJS.ProcessEnv
    expect(resolveRunnerTimeoutMs(env)).toBe(DEFAULT_RUNNER_TIMEOUT_MS)
  })

  it('falls back to the default for zero or negative values', () => {
    expect(resolveRunnerTimeoutMs({ FORGEPILOT_RUNNER_TIMEOUT_MS: '0' } as unknown as NodeJS.ProcessEnv)).toBe(DEFAULT_RUNNER_TIMEOUT_MS)
    expect(resolveRunnerTimeoutMs({ FORGEPILOT_RUNNER_TIMEOUT_MS: '-1000' } as unknown as NodeJS.ProcessEnv)).toBe(DEFAULT_RUNNER_TIMEOUT_MS)
  })

  it('floors a fractional value to an integer', () => {
    const env = { FORGEPILOT_RUNNER_TIMEOUT_MS: '120000.9' } as unknown as NodeJS.ProcessEnv
    expect(resolveRunnerTimeoutMs(env)).toBe(120_000)
  })
})
