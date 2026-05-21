export const AUTH_ENABLED_ENV = 'FORGEPILOT_AUTH_ENABLED'
export const AUTH_DISABLED_ENV = 'FORGEPILOT_AUTH_DISABLED'

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on'])

export function isForgePilotAuthEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (TRUE_VALUES.has(String(env[AUTH_DISABLED_ENV] ?? '').trim().toLowerCase())) {
    return false
  }
  const explicit = env[AUTH_ENABLED_ENV]
  if (explicit != null) {
    return TRUE_VALUES.has(String(explicit).trim().toLowerCase())
  }
  return true
}

export function isAuthApiPath(pathname: string): boolean {
  return pathname.startsWith('/api/auth/')
}

export function isLoginPath(pathname: string): boolean {
  return pathname === '/login' || pathname.startsWith('/login/')
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
  if (isAuthApiPath(pathname) || isLoginPath(pathname) || isPublicOperationalPath(pathname)) {
    return false
  }
  if (pathname.startsWith('/api/')) return true
  return !pathname.startsWith('/_next/')
}
