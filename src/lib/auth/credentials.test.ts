import { describe, expect, it } from 'vitest'
import { validateAdminCredentials } from './credentials'

describe('validateAdminCredentials', () => {
  const env = {
    FORGEPILOT_ADMIN_EMAIL: 'owner@forgepilot.local',
    FORGEPILOT_ADMIN_PASSWORD: 'secret-pass',
    FORGEPILOT_ADMIN_NAME: 'Sven',
    FORGEPILOT_TENANT_ID: 'solo',
  } as unknown as NodeJS.ProcessEnv

  it('returns the single-user owner for matching credentials', async () => {
    await expect(validateAdminCredentials('OWNER@forgepilot.local', 'secret-pass', env)).resolves.toEqual({
      id: 'single-user-owner',
      email: 'owner@forgepilot.local',
      name: 'Sven',
      tenantId: 'solo',
      role: 'owner',
    })
  })

  it('rejects missing or mismatched credentials', async () => {
    await expect(validateAdminCredentials('owner@forgepilot.local', 'wrong', env)).resolves.toBeNull()
    await expect(validateAdminCredentials('other@forgepilot.local', 'secret-pass', env)).resolves.toBeNull()
    await expect(validateAdminCredentials('owner@forgepilot.local', 'secret-pass', {} as unknown as NodeJS.ProcessEnv)).resolves.toBeNull()
  })
})
