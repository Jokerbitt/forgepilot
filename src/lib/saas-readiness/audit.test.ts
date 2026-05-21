import { describe, expect, it } from 'vitest'
import { buildSaaSReadinessAudit } from './audit'

describe('buildSaaSReadinessAudit', () => {
  it('blocks launch when critical auth and tenancy are missing', () => {
    const audit = buildSaaSReadinessAudit({} as unknown as NodeJS.ProcessEnv, new Date('2026-05-21T10:00:00Z'))

    expect(audit.readiness).toBe('blocked')
    expect(audit.score).toBeLessThan(60)
    expect(audit.nextActions[0].severity).toBe('critical')
    expect(audit.checks.find(check => check.id === 'auth-boundary')?.status).toBe('missing')
  })

  it('improves score when auth, tenancy and billing env vars are present', () => {
    const audit = buildSaaSReadinessAudit({
      FORGEPILOT_AUTH_ENABLED: 'true',
      NEXTAUTH_SECRET: 'secret',
      FORGEPILOT_ADMIN_EMAIL: 'owner@example.com',
      FORGEPILOT_ADMIN_PASSWORD: 'password',
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_ANON_KEY: 'anon',
      STRIPE_SECRET_KEY: 'sk_test',
    } as unknown as NodeJS.ProcessEnv)

    expect(audit.checks.find(check => check.id === 'auth-boundary')?.status).toBe('ready')
    expect(audit.checks.find(check => check.id === 'multi-tenancy')?.status).toBe('partial')
    expect(audit.checks.find(check => check.id === 'billing-hook')?.status).toBe('partial')
    expect(audit.score).toBeGreaterThan(50)
  })
})
