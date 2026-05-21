import { describe, expect, it } from 'vitest'
import { isForgePilotAuthEnabled, shouldProtectPath } from './config'

describe('auth config', () => {
  it('keeps auth enabled by default unless explicitly disabled', () => {
    expect(isForgePilotAuthEnabled({} as unknown as NodeJS.ProcessEnv)).toBe(true)
    expect(isForgePilotAuthEnabled({ FORGEPILOT_AUTH_ENABLED: 'true' } as unknown as NodeJS.ProcessEnv)).toBe(true)
    expect(isForgePilotAuthEnabled({ FORGEPILOT_AUTH_ENABLED: '1' } as unknown as NodeJS.ProcessEnv)).toBe(true)
    expect(isForgePilotAuthEnabled({ FORGEPILOT_AUTH_ENABLED: 'false' } as unknown as NodeJS.ProcessEnv)).toBe(false)
    expect(isForgePilotAuthEnabled({ FORGEPILOT_AUTH_DISABLED: 'true' } as unknown as NodeJS.ProcessEnv)).toBe(false)
  })

  it('protects app and api routes while allowing operational routes', () => {
    expect(shouldProtectPath('/')).toBe(true)
    expect(shouldProtectPath('/api/delegations')).toBe(true)
    expect(shouldProtectPath('/api/auth/session')).toBe(false)
    expect(shouldProtectPath('/login')).toBe(false)
    expect(shouldProtectPath('/api/health')).toBe(false)
    expect(shouldProtectPath('/api/ready')).toBe(false)
    expect(shouldProtectPath('/api/cron/telegram-digest')).toBe(false)
    expect(shouldProtectPath('/api/webhooks/linear')).toBe(false)
  })
})
