/**
 * Notification Preferences — M138 / M157
 *
 * Controls which notification types trigger the bell icon and
 * whether sound/badge is shown. Persisted in config/notification-preferences.json
 *
 * M157 adds per-type channel config: bell, telegram, email
 */
import type { NotificationType } from './notification'

/** Delivery channels for a single notification type */
export interface ChannelConfig {
  /** Show in in-app bell / notification inbox */
  bell: boolean
  /** Forward to Telegram bot */
  telegram: boolean
  /** Send via email (future feature, stored but not yet sent) */
  email: boolean
}

export type NotificationChannel = keyof ChannelConfig

export interface NotificationPreferences {
  /** Globally mute all notifications */
  muteAll: boolean
  /** Show unread count badge on bell */
  showBadge: boolean
  /** Per-type opt-in/out (controls all channels simultaneously) */
  types: Record<NotificationType, boolean>
  /** Per-type, per-channel delivery config (M157) */
  channels: Record<NotificationType, ChannelConfig>
  updatedAt: string
}

const DEFAULT_CHANNEL: ChannelConfig = { bell: true, telegram: true, email: false }

const ALL_TYPES: NotificationType[] = [
  'pm-alert', 'research-complete', 'delegation-blocked', 'milestone-at-risk',
  'orchestration-complete', 'orchestration-failed', 'run_complete', 'run_failed',
  'delegation_approved', 'delegation_pending', 'delegation_completed', 'delegation_failed',
  'brief_ready', 'system',
]

/** Sensible defaults: all types enabled, badge shown, telegram on, email off */
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  muteAll: false,
  showBadge: true,
  types: Object.fromEntries(ALL_TYPES.map(t => [t, true])) as Record<NotificationType, boolean>,
  channels: Object.fromEntries(ALL_TYPES.map(t => [t, { ...DEFAULT_CHANNEL }])) as Record<NotificationType, ChannelConfig>,
  updatedAt: new Date().toISOString(),
}

/** Human-readable labels for each notification type */
export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  'pm-alert':              'PM-Warnungen',
  'research-complete':     'Research abgeschlossen',
  'delegation-blocked':    'Delegation blockiert',
  'milestone-at-risk':     'Meilenstein gefährdet',
  'orchestration-complete': 'Orchestrierung abgeschlossen',
  'orchestration-failed':  'Orchestrierung fehlgeschlagen',
  'run_complete': 'Agent-Run abgeschlossen',
  'loop_complete': 'Loop-Zyklus abgeschlossen',
  'run_failed':            'Agent-Run fehlgeschlagen',
  'delegation_approved':   'Delegation freigegeben',
  'delegation_pending':    'Delegation wartet auf Freigabe',
  'delegation_completed':  'Delegation abgeschlossen',
  'delegation_failed':     'Delegation fehlgeschlagen',
  'brief_ready':           'Project Brief bereit',
  'system':                'Systemmeldungen',
}

/** Group notification types for UI rendering */
export const NOTIFICATION_GROUPS: Array<{ label: string; types: NotificationType[] }> = [
  {
    label: 'Agent & Delegation',
    types: ['delegation-blocked', 'delegation_approved', 'orchestration-complete', 'orchestration-failed', 'run_complete', 'run_failed'],
  },
  {
    label: 'Planung & Briefs',
    types: ['pm-alert', 'research-complete', 'milestone-at-risk', 'brief_ready'],
  },
  {
    label: 'System',
    types: ['system'],
  },
]
