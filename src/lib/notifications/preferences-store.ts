import fs from 'fs'
import path from 'path'
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationPreferences,
  type ChannelConfig,
} from '@/lib/models/notification-preferences'
import type { NotificationType } from '@/lib/models/notification'

const PREFS_FILE = path.join(process.cwd(), 'config', 'notification-preferences.json')

const DEFAULT_CHANNEL: ChannelConfig = { bell: true, telegram: true, email: false }

function read(): NotificationPreferences {
  try {
    const stored = JSON.parse(fs.readFileSync(PREFS_FILE, 'utf-8')) as NotificationPreferences
    // Back-fill channels for legacy files that predate M157
    if (!stored.channels) {
      stored.channels = { ...DEFAULT_NOTIFICATION_PREFERENCES.channels }
    }
    return stored
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
    channels: patch.channels
      ? mergeChannels(current.channels, patch.channels)
      : current.channels,
    updatedAt: new Date().toISOString(),
  }
  write(updated)
  return updated
}

/** Deep-merge channel configs: patch overrides individual type/channel combos */
function mergeChannels(
  current: Record<NotificationType, ChannelConfig>,
  patch: Partial<Record<NotificationType, Partial<ChannelConfig>>>,
): Record<NotificationType, ChannelConfig> {
  const result = { ...current }
  for (const [type, channelPatch] of Object.entries(patch)) {
    const t = type as NotificationType
    result[t] = { ...(current[t] ?? DEFAULT_CHANNEL), ...channelPatch }
  }
  return result
}

/** Check if a given notification type should be shown (respects muteAll + per-type toggle) */
export function isNotificationTypeEnabled(
  prefs: NotificationPreferences,
  type: keyof NotificationPreferences['types'],
): boolean {
  if (prefs.muteAll) return false
  return prefs.types[type] ?? true
}

/** Get channel config for a notification type (with defaults for legacy data) */
export function getChannelConfig(
  prefs: NotificationPreferences,
  type: NotificationType,
): ChannelConfig {
  return prefs.channels?.[type] ?? DEFAULT_CHANNEL
}

/** Check if a specific channel is enabled for a type */
export function isChannelEnabled(
  prefs: NotificationPreferences,
  type: NotificationType,
  channel: keyof ChannelConfig,
): boolean {
  if (prefs.muteAll) return false
  if (!(prefs.types[type] ?? true)) return false
  return getChannelConfig(prefs, type)[channel]
}
