import { type NextRequest } from 'next/server'
import { logger } from '@/lib/logger'

/**
 * Checks whether an incoming cron request is authorized.
 *
 * - If CRON_SECRET is set, the request must carry `Authorization: Bearer <secret>`.
 * - If CRON_SECRET is not set, the route is open in non-production environments
 *   (to allow local testing) but logs a warning on every call.
 * - In production without CRON_SECRET, all requests are denied — this avoids
 *   silently running unprotected cron jobs.
 */
export function isCronAuthorized(request: NextRequest, routeName: string): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    logger.warn(
      { event: 'cron.no_secret', route: routeName },
      'CRON_SECRET not set — route is unprotected in non-production',
    )
    return process.env.NODE_ENV !== 'production'
  }
  const auth = request.headers.get('authorization')
  return auth === `Bearer ${secret}`
}
