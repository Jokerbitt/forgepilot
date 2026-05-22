import {
  AUTH_DISABLED_ENV,
  isAuthBypassAllowed,
  isAuthConfigured,
  isForgePilotAuthEnabled,
  isProductionRuntime,
} from './config'

export type AuthReadinessStatus = 'ready' | 'blocked' | 'warning'

export interface AuthReadinessCheck {
  id: 'auth-enabled' | 'admin-password' | 'nextauth-secret' | 'nextauth-url' | 'production-bypass'
  label: string
  status: AuthReadinessStatus
  detail: string
}

export interface AuthReadiness {
  enabled: boolean
  configured: boolean
  bypassRequested: boolean
  bypassAllowed: boolean
  productionRuntime: boolean
  readyForProduction: boolean
  status: AuthReadinessStatus
  missingEnv: string[]
  checks: AuthReadinessCheck[]
  nextAction: string
}

const WEAK_PASSWORD_VALUES = new Set([
  'change-me-before-deploy',
  'changeme',
  'password',
  'dein-sicheres-passwort',
])

function hasValue(value: unknown): boolean {
  return String(value ?? '').trim().length > 0
}

function isStrongSecret(value: unknown): boolean {
  return String(value ?? '').trim().length >= 32
}

function isStrongPassword(value: unknown): boolean {
  const password = String(value ?? '').trim()
  if (password.length < 12) return false
  return !WEAK_PASSWORD_VALUES.has(password.toLowerCase())
}

function isValidUrl(value: unknown): boolean {
  const raw = String(value ?? '').trim()
  if (!raw) return false
  try {
    const parsed = new URL(raw)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function worstStatus(checks: AuthReadinessCheck[]): AuthReadinessStatus {
  if (checks.some(check => check.status === 'blocked')) return 'blocked'
  if (checks.some(check => check.status === 'warning')) return 'warning'
  return 'ready'
}

export function getAuthReadiness(env: NodeJS.ProcessEnv = process.env): AuthReadiness {
  const enabled = isForgePilotAuthEnabled(env)
  const configured = isAuthConfigured(env)
  const bypassRequested = hasValue(env[AUTH_DISABLED_ENV]) && ['1', 'true', 'yes', 'on'].includes(String(env[AUTH_DISABLED_ENV]).toLowerCase())
  const bypassAllowed = isAuthBypassAllowed(env)
  const productionRuntime = isProductionRuntime(env)
  const adminPasswordSet = hasValue(env.FORGEPILOT_ADMIN_PASSWORD)
  const adminPasswordStrong = isStrongPassword(env.FORGEPILOT_ADMIN_PASSWORD)
  const secretSet = hasValue(env.NEXTAUTH_SECRET)
  const secretStrong = isStrongSecret(env.NEXTAUTH_SECRET)
  const nextAuthUrlSet = hasValue(env.NEXTAUTH_URL)
  const nextAuthUrlValid = isValidUrl(env.NEXTAUTH_URL)

  const missingEnv = [
    adminPasswordSet ? null : 'FORGEPILOT_ADMIN_PASSWORD',
    secretSet ? null : 'NEXTAUTH_SECRET',
    nextAuthUrlSet ? null : 'NEXTAUTH_URL',
  ].filter((value): value is string => Boolean(value))

  const checks: AuthReadinessCheck[] = [
    {
      id: 'auth-enabled',
      label: 'Auth enabled',
      status: enabled ? 'ready' : 'blocked',
      detail: enabled
        ? 'Session auth is enforced for protected routes.'
        : 'Auth bypass is active; use this only for isolated local tests.',
    },
    {
      id: 'admin-password',
      label: 'Admin password',
      status: adminPasswordStrong ? 'ready' : adminPasswordSet ? 'blocked' : 'blocked',
      detail: adminPasswordStrong
        ? 'Admin password is configured and strong enough for V1 single-user use.'
        : adminPasswordSet
          ? 'Admin password is present but too weak or still a placeholder.'
          : 'Admin password is missing.',
    },
    {
      id: 'nextauth-secret',
      label: 'NEXTAUTH_SECRET',
      status: secretStrong ? 'ready' : secretSet ? 'blocked' : 'blocked',
      detail: secretStrong
        ? 'NEXTAUTH_SECRET is present with sufficient length.'
        : secretSet
          ? 'NEXTAUTH_SECRET is present but should be at least 32 characters.'
          : 'NEXTAUTH_SECRET is missing.',
    },
    {
      id: 'nextauth-url',
      label: 'NEXTAUTH_URL',
      status: nextAuthUrlValid ? 'ready' : nextAuthUrlSet ? 'warning' : 'warning',
      detail: nextAuthUrlValid
        ? 'NEXTAUTH_URL is set to a valid http(s) URL.'
        : nextAuthUrlSet
          ? 'NEXTAUTH_URL is set but not a valid http(s) URL.'
          : 'NEXTAUTH_URL is missing; set it before non-local use.',
    },
    {
      id: 'production-bypass',
      label: 'Production bypass',
      status: productionRuntime && bypassRequested ? 'blocked' : bypassAllowed ? 'warning' : 'ready',
      detail: productionRuntime && bypassRequested
        ? 'Production runtime requested auth bypass; ForgePilot ignores it, but deployment config should be fixed.'
        : bypassAllowed
          ? 'Dev bypass is allowed in this non-production runtime.'
          : 'No production auth bypass is active.',
    },
  ]

  const status = worstStatus(checks)
  const readyForProduction = status === 'ready' && configured && enabled
  const firstBlocked = checks.find(check => check.status === 'blocked')
  const firstWarning = checks.find(check => check.status === 'warning')

  return {
    enabled,
    configured,
    bypassRequested,
    bypassAllowed,
    productionRuntime,
    readyForProduction,
    status,
    missingEnv,
    checks,
    nextAction: firstBlocked
      ? firstBlocked.detail
      : firstWarning
        ? firstWarning.detail
        : 'Auth is ready for V1 single-user production use.',
  }
}
