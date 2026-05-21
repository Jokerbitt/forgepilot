export const AUTH_DISABLED_ENV = 'FORGEPILOT_AUTH_DISABLED'
export const DEFAULT_ADMIN_EMAIL = 'admin@forgepilot.local'

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on'])

export function isForgePilotAuthEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = String(env[AUTH_DISABLED_ENV] ?? '').trim().toLowerCase()
  return !TRUE_VALUES.has(raw)
}

export function isAuthConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.FORGEPILOT_ADMIN_PASSWORD && env.NEXTAUTH_SECRET)
}

export function isAuthApiPath(pathname: string): boolean {
  return pathname.startsWith('/api/auth/')
}

export function isLoginPath(pathname: string): boolean {
  return pathname === '/login' || pathname.startsWith('/login/')
}

export function isSetupPath(pathname: string): boolean {
  return pathname === '/setup' || pathname.startsWith('/setup/')
}

export function isPublicOperationalPath(pathname: string): boolean {
  return (
    pathname === '/api/health' ||
    pathname === '/api/ready' ||
    pathname.startsWith('/api/cron/') ||
    pathname.startsWith('/api/webhooks/') ||
    pathname === '/api/telegram/webhook' ||
    pathname === '/api/sentry/webhook'
  )
}

export function shouldProtectPath(pathname: string): boolean {
  if (
    isAuthApiPath(pathname) ||
    isLoginPath(pathname) ||
    isSetupPath(pathname) ||
    isPublicOperationalPath(pathname)
  ) {
    return false
  }
  if (pathname.startsWith('/api/')) return true
  return !pathname.startsWith('/_next/')
}
