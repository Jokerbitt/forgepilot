import { describe, expect, it } from 'vitest'
import {
  isForgePilotAuthEnabled,
  isAuthBypassAllowed,
  isAuthConfigured,
  isProductionRuntime,
  shouldProtectPath,
} from './config'

describe('isForgePilotAuthEnabled', () => {
  it('is enabled by default when no env var is set', () => {
    expect(isForgePilotAuthEnabled({} as unknown as NodeJS.ProcessEnv)).toBe(true)
  })

  it('remains enabled when the explicit disable flag is absent or false-like', () => {
    expect(isForgePilotAuthEnabled({ FORGEPILOT_AUTH_DISABLED: '' } as unknown as NodeJS.ProcessEnv)).toBe(true)
    expect(isForgePilotAuthEnabled({ FORGEPILOT_AUTH_DISABLED: 'false' } as unknown as NodeJS.ProcessEnv)).toBe(true)
    expect(isForgePilotAuthEnabled({ FORGEPILOT_AUTH_DISABLED: '0' } as unknown as NodeJS.ProcessEnv)).toBe(true)
    expect(isForgePilotAuthEnabled({ FORGEPILOT_AUTH_DISABLED: 'no' } as unknown as NodeJS.ProcessEnv)).toBe(true)
    expect(isForgePilotAuthEnabled({ FORGEPILOT_AUTH_DISABLED: 'off' } as unknown as NodeJS.ProcessEnv)).toBe(true)
  })

  it('is disabled only when explicitly set to a truthy disable value', () => {
    expect(isForgePilotAuthEnabled({ FORGEPILOT_AUTH_DISABLED: 'true' } as unknown as NodeJS.ProcessEnv)).toBe(false)
    expect(isForgePilotAuthEnabled({ FORGEPILOT_AUTH_DISABLED: '1' } as unknown as NodeJS.ProcessEnv)).toBe(false)
    expect(isForgePilotAuthEnabled({ FORGEPILOT_AUTH_DISABLED: 'yes' } as unknown as NodeJS.ProcessEnv)).toBe(false)
    expect(isForgePilotAuthEnabled({ FORGEPILOT_AUTH_DISABLED: 'on' } as unknown as NodeJS.ProcessEnv)).toBe(false)
  })

  it('is case-insensitive', () => {
    expect(isForgePilotAuthEnabled({ FORGEPILOT_AUTH_DISABLED: 'TRUE' } as unknown as NodeJS.ProcessEnv)).toBe(false)
    expect(isForgePilotAuthEnabled({ FORGEPILOT_AUTH_DISABLED: 'False' } as unknown as NodeJS.ProcessEnv)).toBe(true)
  })

  it('stays enabled in production even when the bypass flag is accidentally set', () => {
    expect(
      isForgePilotAuthEnabled({
        FORGEPILOT_AUTH_DISABLED: 'true',
        NODE_ENV: 'production',
      } as unknown as NodeJS.ProcessEnv),
    ).toBe(true)
    expect(
      isForgePilotAuthEnabled({
        FORGEPILOT_AUTH_DISABLED: 'true',
        VERCEL_ENV: 'production',
      } as unknown as NodeJS.ProcessEnv),
    ).toBe(true)
  })
})

describe('isProductionRuntime', () => {
  it('detects production from NODE_ENV and VERCEL_ENV', () => {
    expect(isProductionRuntime({ NODE_ENV: 'production' } as unknown as NodeJS.ProcessEnv)).toBe(true)
    expect(isProductionRuntime({ NODE_ENV: 'prod' } as unknown as NodeJS.ProcessEnv)).toBe(true)
    expect(isProductionRuntime({ VERCEL_ENV: 'production' } as unknown as NodeJS.ProcessEnv)).toBe(true)
  })

  it('treats local, test, development, and Vercel preview as non-production', () => {
    expect(isProductionRuntime({ NODE_ENV: 'development' } as unknown as NodeJS.ProcessEnv)).toBe(false)
    expect(isProductionRuntime({ NODE_ENV: 'test' } as unknown as NodeJS.ProcessEnv)).toBe(false)
    expect(isProductionRuntime({ VERCEL_ENV: 'preview' } as unknown as NodeJS.ProcessEnv)).toBe(false)
  })
})

describe('isAuthBypassAllowed', () => {
  it('allows explicit bypass only outside production', () => {
    expect(isAuthBypassAllowed({ FORGEPILOT_AUTH_DISABLED: 'true' } as unknown as NodeJS.ProcessEnv)).toBe(true)
    expect(
      isAuthBypassAllowed({
        FORGEPILOT_AUTH_DISABLED: 'true',
        NODE_ENV: 'production',
      } as unknown as NodeJS.ProcessEnv),
    ).toBe(false)
    expect(
      isAuthBypassAllowed({
        FORGEPILOT_AUTH_DISABLED: 'true',
        VERCEL_ENV: 'production',
      } as unknown as NodeJS.ProcessEnv),
    ).toBe(false)
  })
})

describe('isAuthConfigured', () => {
  it('returns false when neither password nor secret is set', () => {
    expect(isAuthConfigured({} as unknown as NodeJS.ProcessEnv)).toBe(false)
  })

  it('returns false when only FORGEPILOT_ADMIN_PASSWORD is set', () => {
    expect(isAuthConfigured({ FORGEPILOT_ADMIN_PASSWORD: 'secret123' } as unknown as NodeJS.ProcessEnv)).toBe(false)
  })

  it('returns false when only NEXTAUTH_SECRET is set', () => {
    expect(isAuthConfigured({ NEXTAUTH_SECRET: 'some-secret' } as unknown as NodeJS.ProcessEnv)).toBe(false)
  })

  it('returns true when both admin password and NEXTAUTH_SECRET are set', () => {
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
