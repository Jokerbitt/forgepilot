import { describe, it, expect } from 'vitest'
import { buildRunnerBaseEnv } from './runner-env'

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
