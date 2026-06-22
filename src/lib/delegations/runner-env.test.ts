import { describe, it, expect } from 'vitest'
import { buildRunnerBaseEnv, resolveRunnerTimeoutMs, DEFAULT_RUNNER_TIMEOUT_MS } from './runner-env'

describe('buildRunnerBaseEnv', () => {
  const parent = {
    NODE_ENV: 'development',
    ANTHROPIC_API_KEY: 'sk-ant-credit-less',
    OPENAI_API_KEY: 'sk-openai',
    PATH: '/usr/bin',
    HOME: '/home/forge',
  } as unknown as NodeJS.ProcessEnv

  it('drops NODE_ENV so target tooling picks its own (next build → production)', () => {
    const env = buildRunnerBaseEnv(parent, 'ANTHROPIC_API_KEY')
    expect('NODE_ENV' in env).toBe(false)
    expect(env.NODE_ENV).toBeUndefined()
  })

  it('drops the named provider API key but keeps the other', () => {
    const env = buildRunnerBaseEnv(parent, 'ANTHROPIC_API_KEY')
    expect('ANTHROPIC_API_KEY' in env).toBe(false)
    expect(env.OPENAI_API_KEY).toBe('sk-openai')
  })

  it('strips OPENAI_API_KEY when requested (Codex path)', () => {
    const env = buildRunnerBaseEnv(parent, 'OPENAI_API_KEY')
    expect('OPENAI_API_KEY' in env).toBe(false)
    expect(env.ANTHROPIC_API_KEY).toBe('sk-ant-credit-less')
  })

  it('preserves all other inherited variables', () => {
    const env = buildRunnerBaseEnv(parent, 'ANTHROPIC_API_KEY')
    expect(env.PATH).toBe('/usr/bin')
    expect(env.HOME).toBe('/home/forge')
  })

  it('does not mutate the parent env', () => {
    buildRunnerBaseEnv(parent, 'ANTHROPIC_API_KEY')
    expect(parent.NODE_ENV).toBe('development')
    expect(parent.ANTHROPIC_API_KEY).toBe('sk-ant-credit-less')
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
