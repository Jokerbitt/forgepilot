export const AUTH_ENABLED_ENV = 'FORGEPILOT_AUTH_ENABLED'

const FALSE_VALUES = new Set(['0', 'false', 'no', 'off'])

export function isForgePilotAuthEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = String(env[AUTH_ENABLED_ENV] ?? '').trim().toLowerCase()
  // Disabled only when explicitly set to a falsy value
  if (raw !== '' && FALSE_VALUES.has(raw)) return false
  return true // enabled by default
}

export function isAuthConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.FORGEPILOT_ADMIN_PASSWORD || env.NEXTAUTH_SECRET)
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
