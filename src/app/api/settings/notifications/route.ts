import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { z } from 'zod'
import {
  readNotificationPreferences,
  updateNotificationPreferences,
} from '@/lib/notifications/preferences-store'
import type { NotificationPreferences } from '@/lib/models/notification-preferences'

export const dynamic = 'force-dynamic'

const ChannelConfigSchema = z.object({
  bell:     z.boolean().optional(),
  telegram: z.boolean().optional(),
  email:    z.boolean().optional(),
})

const UpdatePrefsSchema = z.object({
  muteAll:   z.boolean().optional(),
  showBadge: z.boolean().optional(),
  types:     z.record(z.string(), z.boolean()).optional(),
  channels:  z.record(z.string(), ChannelConfigSchema).optional(),
})

export async function GET() {
  const authError = await requireAuth()
  if (authError) return authError

  const prefs = readNotificationPreferences()
  return NextResponse.json(prefs)
}

export async function PUT(request: NextRequest) {
  const authError = await requireAuth()
  if (authError) return authError

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = UpdatePrefsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', fields: parsed.error.flatten().fieldErrors },
      { status: 400 },
    )
  }

  const patch = parsed.data as Partial<Omit<NotificationPreferences, 'updatedAt'>>
  const updated = updateNotificationPreferences(patch)
  return NextResponse.json(updated)
}
