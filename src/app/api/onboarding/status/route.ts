/**
 * GET /api/onboarding/status
 *
 * Returns the current onboarding completion status for the wizard.
 */

import { NextResponse } from 'next/server'
import { getOnboardingStatus } from '@/lib/onboarding/status'

export const dynamic = 'force-dynamic'

export async function GET() {
  const status = getOnboardingStatus()
  return NextResponse.json(status)
}
