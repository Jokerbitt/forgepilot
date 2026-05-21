import fs from 'fs'
import path from 'path'
import type { Notification } from '@/lib/models/notification'

/** Fire-and-forget: forward notification to Telegram if configured + channel enabled */
async function forwardToTelegram(notification: Notification): Promise<void> {
  try {
    // M157: respect per-type telegram channel preference
    const { readNotificationPreferences, isChannelEnabled } = await import('./preferences-store')
    const prefs = readNotificationPreferences()
    if (!isChannelEnabled(prefs, notification.type, 'telegram')) return

    const { isTelegramEnabled, readTelegramConfig } = await import('@/lib/telegram/config')
    if (!isTelegramEnabled()) return
    const cfg = readTelegramConfig()
    if (!cfg) return
    if (!cfg.notifyOnSeverity.includes(notification.severity as 'info' | 'warning' | 'critical')) return
    const { sendTelegramMessage, formatNotification, delegationApprovalKeyboard } = await import('@/lib/telegram/bot')
    const text = formatNotification(notification)

    // For delegation_pending notifications: attach inline Approve/Reject keyboard
    const isDelegationPending =
      notification.type === 'delegation_pending' && typeof notification.link === 'string'
    const delegationId = isDelegationPending
      ? notification.link!.split('/').pop()
      : undefined

    await sendTelegramMessage(text, {
      parseMode: 'Markdown',
      disableWebPagePreview: true,
      replyMarkup: delegationId ? delegationApprovalKeyboard(delegationId) : undefined,
    })
  } catch { /* non-fatal — Telegram errors must never crash the notification store */ }
}

const NOTIFICATIONS_FILE = path.join(process.cwd(), 'config', 'notifications.json')

function read(): Notification[] {
  try {
    return JSON.parse(fs.readFileSync(NOTIFICATIONS_FILE, 'utf-8')) as Notification[]
  } catch {
    return []
  }
}

function write(notifications: Notification[]): void {
  const dir = path.dirname(NOTIFICATIONS_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const tmp = NOTIFICATIONS_FILE + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(notifications, null, 2), 'utf-8')
  fs.renameSync(tmp, NOTIFICATIONS_FILE)
}

const MAX_NOTIFICATIONS = 50

export function saveNotification(notification: Notification): void {
  const notifications = read()
  notifications.unshift(notification)
  // Store rotation: drop oldest read notifications first, then unread, cap at MAX
  if (notifications.length > MAX_NOTIFICATIONS) {
    const readOnes = notifications.filter(n => n.read)
    const unreadOnes = notifications.filter(n => !n.read)
    const keepRead = Math.max(MAX_NOTIFICATIONS - unreadOnes.length, 0)
    const trimmed = [...unreadOnes, ...readOnes.slice(0, keepRead)]
    write(trimmed.slice(0, MAX_NOTIFICATIONS))
    return
  }
  write(notifications)
  void forwardToTelegram(notification)
}

export function readNotifications(): Notification[] {
  return read()
}

export function markAsRead(id: string): boolean {
  const notifications = read()
  const idx = notifications.findIndex(n => n.id === id)
  if (idx === -1) return false
  notifications[idx] = { ...notifications[idx], read: true }
  write(notifications)
  return true
}

export function markAllAsRead(): void {
  const notifications = read()
  const updated = notifications.map(n => ({ ...n, read: true }))
  write(updated)
}

export function getUnreadCount(): number {
  return read().filter(n => !n.read).length
}
