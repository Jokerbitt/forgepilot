import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from './options'
import { isForgePilotAuthEnabled } from './config'

/**
 * Route-level auth guard (defense-in-depth on top of middleware).
 *
 * Returns a 401 NextResponse when:
 *   - auth is enabled (FORGEPILOT_AUTH_DISABLED !== 'true')  AND
 *   - no valid NextAuth session is found
 *
 * Returns null when:
 *   - FORGEPILOT_AUTH_DISABLED=true  (dev bypass — never use in production)
 *   - a valid session exists
 *
 * Usage:
 *   const authError = await requireAuth()
 *   if (authError) return authError
 */
export async function requireAuth(): Promise<NextResponse | null> {
  if (!isForgePilotAuthEnabled()) return null

  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}
