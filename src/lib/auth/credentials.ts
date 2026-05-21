import { timingSafeEqual } from 'node:crypto'

export interface ForgePilotUser {
  id: string
  email: string
  name: string
  tenantId: string
  role: 'owner'
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

export async function validateAdminCredentials(
  email: string | undefined,
  password: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): Promise<ForgePilotUser | null> {
  const configuredEmail = env.FORGEPILOT_ADMIN_EMAIL?.trim()
  const configuredPassword = env.FORGEPILOT_ADMIN_PASSWORD

  // V1 note: Password is stored as plaintext in .env.local — no DB hash needed yet.
  // Warn at runtime if the configured password is too short to be secure.
  if (configuredPassword && configuredPassword.length < 12) {
    console.warn(
      '[ForgePilot] FORGEPILOT_ADMIN_PASSWORD is shorter than 12 characters — use a stronger password',
    )
  }

  if (!configuredEmail || !configuredPassword || !email || !password) {
    return null
  }

  const normalizedEmail = email.trim().toLowerCase()
  if (!safeEqual(normalizedEmail, configuredEmail.toLowerCase())) return null
  if (!safeEqual(password, configuredPassword)) return null

  return {
    id: 'single-user-owner',
    email: configuredEmail,
    name: env.FORGEPILOT_ADMIN_NAME?.trim() || configuredEmail,
    tenantId: env.FORGEPILOT_TENANT_ID?.trim() || 'default',
    role: 'owner',
  }
}
