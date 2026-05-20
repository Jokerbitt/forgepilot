export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { markAsRead, markAllAsRead } from '@/lib/notifications/notification-store'

interface MarkReadBody {
  id?: string
  all?: boolean
}

export async function POST(request: NextRequest) {
  let body: MarkReadBody
  try {
    body = await request.json() as MarkReadBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (body.all === true) {
    markAllAsRead()
    return NextResponse.json({ success: true })
  }

  if (typeof body.id === 'string') {
    const success = markAsRead(body.id)
    if (!success) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Provide either { id: string } or { all: true }' }, { status: 400 })
}
