/**
 * Notification Preferences — M138
 *
 * Controls which notification types trigger the bell icon and
 * whether sound/badge is shown. Persisted in config/notification-preferences.json
 */
import type { NotificationType } from './notification'

export interface NotificationPreferences {
  /** Globally mute all notifications */
  muteAll: boolean
  /** Show unread count badge on bell */
  showBadge: boolean
  /** Per-type opt-in/out */
  types: Record<NotificationType, boolean>
  updatedAt: string
}

/** Sensible defaults: all types enabled, badge shown */
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  muteAll: false,
  showBadge: true,
  types: {
    'pm-alert':              true,
    'research-complete':     true,
    'delegation-blocked':    true,
    'milestone-at-risk':     true,
    'orchestration-complete': true,
    'orchestration-failed':  true,
    'run_complete':          true,
    'run_failed':            true,
    'delegation_approved':   true,
    'brief_ready':           true,
    'system':                true,
  },
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
  'run_complete':          'Agent-Run abgeschlossen',
  'run_failed':            'Agent-Run fehlgeschlagen',
  'delegation_approved':   'Delegation freigegeben',
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
