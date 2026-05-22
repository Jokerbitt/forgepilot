import { describe, expect, it } from 'vitest'
import { getAuthReadiness } from './readiness'

describe('getAuthReadiness', () => {
  it('blocks production readiness when auth bypass is active in local dev', () => {
    const result = getAuthReadiness({
      FORGEPILOT_AUTH_DISABLED: 'true',
      FORGEPILOT_ADMIN_PASSWORD: 'very-secure-password',
      NEXTAUTH_SECRET: 'x'.repeat(40),
      NEXTAUTH_URL: 'http://localhost:3000',
    } as unknown as NodeJS.ProcessEnv)

    expect(result.enabled).toBe(false)
    expect(result.bypassAllowed).toBe(true)
    expect(result.readyForProduction).toBe(false)
    expect(result.status).toBe('blocked')
    expect(result.checks.find(check => check.id === 'auth-enabled')?.status).toBe('blocked')
  })

  it('reports missing required environment variables without leaking values', () => {
    const result = getAuthReadiness({} as unknown as NodeJS.ProcessEnv)

    expect(result.missingEnv).toEqual([
      'FORGEPILOT_ADMIN_PASSWORD',
      'NEXTAUTH_SECRET',
      'NEXTAUTH_URL',
    ])
    expect(result.readyForProduction).toBe(false)
    expect(JSON.stringify(result)).not.toContain('super-secret-value')
  })

  it('blocks weak placeholders and short secrets', () => {
    const result = getAuthReadiness({
      FORGEPILOT_ADMIN_PASSWORD: 'change-me-before-deploy',
      NEXTAUTH_SECRET: 'short',
      NEXTAUTH_URL: 'http://localhost:3000',
    } as unknown as NodeJS.ProcessEnv)

    expect(result.checks.find(check => check.id === 'admin-password')?.status).toBe('blocked')
    expect(result.checks.find(check => check.id === 'nextauth-secret')?.status).toBe('blocked')
  })

  it('is ready when auth is enabled and required config is strong', () => {
    const result = getAuthReadiness({
      FORGEPILOT_ADMIN_PASSWORD: 'very-secure-password',
      NEXTAUTH_SECRET: 'x'.repeat(40),
      NEXTAUTH_URL: 'http://localhost:3000',
    } as unknown as NodeJS.ProcessEnv)

    expect(result.status).toBe('ready')
    expect(result.readyForProduction).toBe(true)
    expect(result.missingEnv).toEqual([])
  })

  it('warns when only NEXTAUTH_URL is missing', () => {
    const result = getAuthReadiness({
      FORGEPILOT_ADMIN_PASSWORD: 'very-secure-password',
      NEXTAUTH_SECRET: 'x'.repeat(40),
    } as unknown as NodeJS.ProcessEnv)

    expect(result.status).toBe('warning')
    expect(result.readyForProduction).toBe(false)
    expect(result.checks.find(check => check.id === 'nextauth-url')?.status).toBe('warning')
  })
})
