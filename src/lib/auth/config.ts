export const AUTH_DISABLED_ENV = 'FORGEPILOT_AUTH_DISABLED'
export const DEFAULT_ADMIN_EMAIL = 'admin@forgepilot.local'

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on'])
const PRODUCTION_ENV_VALUES = new Set(['production', 'prod'])

function isTruthy(value: unknown): boolean {
  return TRUE_VALUES.has(String(value ?? '').trim().toLowerCase())
}

export function isProductionRuntime(env: NodeJS.ProcessEnv = process.env): boolean {
  const nodeEnv = String(env.NODE_ENV ?? '').trim().toLowerCase()
  const vercelEnv = String(env.VERCEL_ENV ?? '').trim().toLowerCase()
  return PRODUCTION_ENV_VALUES.has(nodeEnv) || PRODUCTION_ENV_VALUES.has(vercelEnv)
}

export function isAuthBypassAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  return isTruthy(env[AUTH_DISABLED_ENV]) && !isProductionRuntime(env)
}

export function isForgePilotAuthEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return !isAuthBypassAllowed(env)
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
