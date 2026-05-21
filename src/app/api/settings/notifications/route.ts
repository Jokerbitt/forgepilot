import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  readNotificationPreferences,
  updateNotificationPreferences,
} from '@/lib/notifications/preferences-store'
import type { NotificationPreferences } from '@/lib/models/notification-preferences'

export const dynamic = 'force-dynamic'

const UpdatePrefsSchema = z.object({
  muteAll: z.boolean().optional(),
  showBadge: z.boolean().optional(),
  types: z.record(z.string(), z.boolean()).optional(),
})

export async function GET() {
  const prefs = readNotificationPreferences()
  return NextResponse.json(prefs)
}

export async function PUT(request: NextRequest) {
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
