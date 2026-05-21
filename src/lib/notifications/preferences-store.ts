import fs from 'fs'
import path from 'path'
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationPreferences,
} from '@/lib/models/notification-preferences'

const PREFS_FILE = path.join(process.cwd(), 'config', 'notification-preferences.json')

function read(): NotificationPreferences {
  try {
    return JSON.parse(fs.readFileSync(PREFS_FILE, 'utf-8')) as NotificationPreferences
  } catch {
    return DEFAULT_NOTIFICATION_PREFERENCES
  }
}

function write(prefs: NotificationPreferences): void {
  const dir = path.dirname(PREFS_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const tmp = PREFS_FILE + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(prefs, null, 2), 'utf-8')
  fs.renameSync(tmp, PREFS_FILE)
}

export function readNotificationPreferences(): NotificationPreferences {
  return read()
}

export function updateNotificationPreferences(
  patch: Partial<Omit<NotificationPreferences, 'updatedAt'>>,
): NotificationPreferences {
  const current = read()
  const updated: NotificationPreferences = {
    ...current,
    ...patch,
    types: patch.types ? { ...current.types, ...patch.types } : current.types,
    updatedAt: new Date().toISOString(),
  }
  write(updated)
  return updated
}

/** Check if a given notification type should be shown (respects muteAll + per-type toggle) */
export function isNotificationTypeEnabled(
  prefs: NotificationPreferences,
  type: keyof NotificationPreferences['types'],
): boolean {
  if (prefs.muteAll) return false
  return prefs.types[type] ?? true
}
