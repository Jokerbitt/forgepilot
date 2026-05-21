import { describe, expect, it } from 'vitest'
import { isForgePilotAuthEnabled, isAuthConfigured, shouldProtectPath } from './config'

describe('isForgePilotAuthEnabled', () => {
  it('is enabled by default when no env var is set', () => {
    expect(isForgePilotAuthEnabled({} as unknown as NodeJS.ProcessEnv)).toBe(true)
  })

  it('remains enabled when set to a truthy value', () => {
    expect(isForgePilotAuthEnabled({ FORGEPILOT_AUTH_ENABLED: 'true' } as unknown as NodeJS.ProcessEnv)).toBe(true)
    expect(isForgePilotAuthEnabled({ FORGEPILOT_AUTH_ENABLED: '1' } as unknown as NodeJS.ProcessEnv)).toBe(true)
    expect(isForgePilotAuthEnabled({ FORGEPILOT_AUTH_ENABLED: 'yes' } as unknown as NodeJS.ProcessEnv)).toBe(true)
    expect(isForgePilotAuthEnabled({ FORGEPILOT_AUTH_ENABLED: 'on' } as unknown as NodeJS.ProcessEnv)).toBe(true)
  })

  it('is disabled when explicitly set to a falsy value', () => {
    expect(isForgePilotAuthEnabled({ FORGEPILOT_AUTH_ENABLED: 'false' } as unknown as NodeJS.ProcessEnv)).toBe(false)
    expect(isForgePilotAuthEnabled({ FORGEPILOT_AUTH_ENABLED: '0' } as unknown as NodeJS.ProcessEnv)).toBe(false)
    expect(isForgePilotAuthEnabled({ FORGEPILOT_AUTH_ENABLED: 'no' } as unknown as NodeJS.ProcessEnv)).toBe(false)
    expect(isForgePilotAuthEnabled({ FORGEPILOT_AUTH_ENABLED: 'off' } as unknown as NodeJS.ProcessEnv)).toBe(false)
  })

  it('is case-insensitive', () => {
    expect(isForgePilotAuthEnabled({ FORGEPILOT_AUTH_ENABLED: 'FALSE' } as unknown as NodeJS.ProcessEnv)).toBe(false)
    expect(isForgePilotAuthEnabled({ FORGEPILOT_AUTH_ENABLED: 'True' } as unknown as NodeJS.ProcessEnv)).toBe(true)
  })
})

describe('isAuthConfigured', () => {
  it('returns false when neither password nor secret is set', () => {
    expect(isAuthConfigured({} as unknown as NodeJS.ProcessEnv)).toBe(false)
  })

  it('returns true when FORGEPILOT_ADMIN_PASSWORD is set', () => {
    expect(isAuthConfigured({ FORGEPILOT_ADMIN_PASSWORD: 'secret123' } as unknown as NodeJS.ProcessEnv)).toBe(true)
  })

  it('returns true when NEXTAUTH_SECRET is set', () => {
    expect(isAuthConfigured({ NEXTAUTH_SECRET: 'some-secret' } as unknown as NodeJS.ProcessEnv)).toBe(true)
  })

  it('returns true when both are set', () => {
    expect(
      isAuthConfigured({
        FORGEPILOT_ADMIN_PASSWORD: 'secret123',
        NEXTAUTH_SECRET: 'some-secret',
      } as unknown as NodeJS.ProcessEnv),
    ).toBe(true)
  })
})

describe('shouldProtectPath', () => {
  it('protects app and api routes', () => {
    expect(shouldProtectPath('/')).toBe(true)
    expect(shouldProtectPath('/api/delegations')).toBe(true)
  })

  it('does not protect auth, login, setup, and operational routes', () => {
    expect(shouldProtectPath('/api/auth/session')).toBe(false)
    expect(shouldProtectPath('/login')).toBe(false)
    expect(shouldProtectPath('/setup')).toBe(false)
    expect(shouldProtectPath('/setup/')).toBe(false)
    expect(shouldProtectPath('/api/health')).toBe(false)
    expect(shouldProtectPath('/api/ready')).toBe(false)
    expect(shouldProtectPath('/api/cron/telegram-digest')).toBe(false)
    expect(shouldProtectPath('/api/webhooks/linear')).toBe(false)
  })
})
