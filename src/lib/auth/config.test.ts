import { describe, expect, it } from 'vitest'
import {
  isForgePilotAuthEnabled,
  isAuthBypassAllowed,
  isAuthConfigured,
  isAuthSecure,
  getAuthSecurityIssues,
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

describe('isAuthSecure', () => {
  const strong = (overrides: Record<string, string> = {}) =>
    ({
      FORGEPILOT_ADMIN_PASSWORD: 'SuperSecret!2026',
      NEXTAUTH_SECRET: 'a'.repeat(32),
      ...overrides,
    } as unknown as NodeJS.ProcessEnv)

  it('returns true for properly configured secrets', () => {
    expect(isAuthSecure(strong())).toBe(true)
  })

  it('rejects placeholder admin password', () => {
    expect(isAuthSecure(strong({ FORGEPILOT_ADMIN_PASSWORD: 'change-me-before-deploy' }))).toBe(false)
    expect(isAuthSecure(strong({ FORGEPILOT_ADMIN_PASSWORD: 'changeme' }))).toBe(false)
  })

  it('rejects placeholder NEXTAUTH_SECRET', () => {
    expect(isAuthSecure(strong({ NEXTAUTH_SECRET: 'generate-with-openssl-rand-base64-32' }))).toBe(false)
  })

  it('rejects passwords shorter than 12 characters', () => {
    expect(isAuthSecure(strong({ FORGEPILOT_ADMIN_PASSWORD: 'short' }))).toBe(false)
    expect(isAuthSecure(strong({ FORGEPILOT_ADMIN_PASSWORD: '11chars!!!!' }))).toBe(false)
  })

  it('rejects NEXTAUTH_SECRET shorter than 32 characters', () => {
    expect(isAuthSecure(strong({ NEXTAUTH_SECRET: 'too-short' }))).toBe(false)
  })
})

describe('getAuthSecurityIssues', () => {
  it('returns no issues for a secure config', () => {
    expect(
      getAuthSecurityIssues({
        FORGEPILOT_ADMIN_PASSWORD: 'SuperSecret!2026',
        NEXTAUTH_SECRET: 'a'.repeat(32),
        NEXTAUTH_URL: 'http://localhost:3000',
      } as unknown as NodeJS.ProcessEnv),
    ).toHaveLength(0)
  })

  it('flags missing password and secret', () => {
    const issues = getAuthSecurityIssues({} as unknown as NodeJS.ProcessEnv)
    expect(issues.some(i => i.includes('FORGEPILOT_ADMIN_PASSWORD'))).toBe(true)
    expect(issues.some(i => i.includes('NEXTAUTH_SECRET'))).toBe(true)
  })

  it('flags placeholder values', () => {
    const issues = getAuthSecurityIssues({
      FORGEPILOT_ADMIN_PASSWORD: 'change-me-before-deploy',
      NEXTAUTH_SECRET: 'generate-with-openssl-rand-base64-32',
    } as unknown as NodeJS.ProcessEnv)
    expect(issues.some(i => i.includes('placeholder'))).toBe(true)
  })

  it('flags non-https NEXTAUTH_URL in production', () => {
    const issues = getAuthSecurityIssues({
      FORGEPILOT_ADMIN_PASSWORD: 'SuperSecret!2026',
      NEXTAUTH_SECRET: 'a'.repeat(32),
      NEXTAUTH_URL: 'http://myapp.example.com',
      NODE_ENV: 'production',
    } as unknown as NodeJS.ProcessEnv)
    expect(issues.some(i => i.includes('https://'))).toBe(true)
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
