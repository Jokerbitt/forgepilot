export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { readNotifications } from '@/lib/notifications/notification-store'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const unreadOnly = searchParams.get('unread') === 'true'

  const notifications = readNotifications()
  const filtered = unreadOnly ? notifications.filter(n => !n.read) : notifications

  return NextResponse.json(filtered)
}
