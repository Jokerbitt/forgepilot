export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { markAsRead, markAllAsRead } from '@/lib/notifications/notification-store'
import { parseBody, isValidationError } from '@/lib/validation/api'
import { NotificationMarkReadSchema } from '@/lib/validation/schemas'

export async function POST(request: NextRequest) {
  const result = await parseBody(request, NotificationMarkReadSchema)
  if (isValidationError(result)) return result

  if (result.all === true) {
    markAllAsRead()
    return NextResponse.json({ success: true })
  }

  if (typeof result.id === 'string') {
    const success = markAsRead(result.id)
    if (!success) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Provide either { id: string } or { all: true }' }, { status: 400 })
}
