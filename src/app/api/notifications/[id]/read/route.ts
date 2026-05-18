import { NextResponse } from 'next/server'
import { markAsRead } from '@/lib/notifications/notification-store'

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const success = markAsRead(id)

  if (!success) {
    return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
