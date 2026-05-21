import { readNotifications } from '@/lib/notifications/notification-store'
import { readDelegations } from '@/lib/delegations/queue'
import { getRuns } from '@/lib/agent-runs/store'

export type DigestPeriod = 'daily' | 'weekly'

export interface DigestSection {
  title: string
  items: DigestItem[]
}

export interface DigestItem {
  label: string
  value: string
  link?: string
  severity?: 'ok' | 'warning' | 'critical'
}

export interface ActivityDigest {
  period: DigestPeriod
  generatedAt: string
  since: string
  stats: {
    totalNotifications: number
    unreadNotifications: number
    criticalNotifications: number
    completedDelegations: number
    failedDelegations: number
    runningDelegations: number
    completedRuns: number
    failedRuns: number
    totalRunCostUsd: number
  }
  sections: DigestSection[]
  emailBody: string
}

function cutoff(period: DigestPeriod): Date {
  const now = new Date()
  if (period === 'weekly') {
    now.setDate(now.getDate() - 7)
  } else {
    now.setHours(now.getHours() - 24)
  }
  return now
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('de-DE', {
      day: '2-digit', month: '2-digit',
      hour: '2-digit', minute: '2-digit',
    })
  } catch { return iso }
}

function fmtCost(usd: number): string {
  if (usd === 0) return '–'
  if (usd < 0.01) return `$${(usd * 100).toFixed(3)}¢`
  return `$${usd.toFixed(4)}`
}

export function buildDigest(period: DigestPeriod = 'daily'): ActivityDigest {
  const since = cutoff(period)
  const sinceIso = since.toISOString()

  // ── Notifications ──
  const allNotifications = readNotifications()
  const recentNotifications = allNotifications.filter(n => n.createdAt >= sinceIso)
  const unreadNotifications = recentNotifications.filter(n => !n.read)
  const criticalNotifications = recentNotifications.filter(n => n.severity === 'critical')

  const notifSection: DigestSection = {
    title: 'Benachrichtigungen',
    items: recentNotifications.slice(0, 10).map(n => ({
      label: `[${n.severity.toUpperCase()}] ${n.title}`,
      value: `${n.body} (${fmtDate(n.createdAt)})`,
      link: n.link,
      severity: n.severity === 'critical' ? 'critical' : n.severity === 'warning' ? 'warning' : 'ok',
    })),
  }
  if (notifSection.items.length === 0) {
    notifSection.items.push({ label: 'Keine Benachrichtigungen', value: `Im Zeitraum ${period === 'daily' ? 'der letzten 24h' : 'der letzten 7 Tage'}.` })
  }

  // ── Delegations ──
  const allDelegations = readDelegations()
  const recentDelegations = allDelegations.filter(d => d.updatedAt >= sinceIso)
  const completedDelegations = recentDelegations.filter(d => d.status === 'completed')
  const failedDelegations = recentDelegations.filter(d => d.status === 'failed')
  const runningDelegations = recentDelegations.filter(d => d.status === 'running')

  const delegationSection: DigestSection = {
    title: 'Delegationen',
    items: [
      { label: 'Abgeschlossen', value: String(completedDelegations.length), severity: completedDelegations.length > 0 ? 'ok' : undefined },
      { label: 'Fehlgeschlagen', value: String(failedDelegations.length), severity: failedDelegations.length > 0 ? 'critical' : undefined },
      { label: 'Aktiv / Laufend', value: String(runningDelegations.length) },
      ...completedDelegations.slice(0, 5).map(d => ({
        label: `✅ ${d.title || d.contract.goal.slice(0, 60)}`,
        value: fmtDate(d.updatedAt),
        link: `/delegations/${d.id}`,
        severity: 'ok' as const,
      })),
      ...failedDelegations.slice(0, 5).map(d => ({
        label: `❌ ${d.title || d.contract.goal.slice(0, 60)}`,
        value: fmtDate(d.updatedAt),
        link: `/delegations/${d.id}`,
        severity: 'critical' as const,
      })),
    ],
  }

  // ── Agent Runs ──
  const allRuns = getRuns()
  const recentRuns = allRuns.filter(r => r.startedAt >= sinceIso)
  const completedRuns = recentRuns.filter(r => r.status === 'completed')
  const failedRuns = recentRuns.filter(r => r.status === 'failed')
  const totalRunCostUsd = recentRuns.reduce((sum, r) => sum + (r.totalCostUsd ?? 0), 0)
  const totalTokenInput = recentRuns.reduce((sum, r) => sum + (r.tokenInput ?? 0), 0)
  const totalTokenOutput = recentRuns.reduce((sum, r) => sum + (r.tokenOutput ?? 0), 0)

  const runSection: DigestSection = {
    title: 'Agent Runs',
    items: [
      { label: 'Erfolgreich', value: String(completedRuns.length), severity: completedRuns.length > 0 ? 'ok' : undefined },
      { label: 'Fehlgeschlagen', value: String(failedRuns.length), severity: failedRuns.length > 0 ? 'critical' : undefined },
      { label: 'Tokens verbraucht', value: `${(totalTokenInput + totalTokenOutput).toLocaleString('de-DE')} (${totalTokenInput.toLocaleString('de-DE')} in / ${totalTokenOutput.toLocaleString('de-DE')} out)` },
      { label: 'Gesamtkosten', value: fmtCost(totalRunCostUsd), severity: totalRunCostUsd > 1 ? 'warning' : undefined },
    ],
  }

  const periodLabel = period === 'daily' ? 'Letzten 24 Stunden' : 'Letzte 7 Tage'

  // ── Plain-text email body ──
  const lines: string[] = [
    `ForgePilot Digest — ${periodLabel}`,
    `Erstellt: ${new Date().toLocaleString('de-DE')}`,
    `Seit: ${since.toLocaleString('de-DE')}`,
    '',
  ]
  for (const section of [notifSection, delegationSection, runSection]) {
    lines.push(`=== ${section.title} ===`)
    for (const item of section.items) {
      lines.push(`  ${item.label}: ${item.value}${item.link ? ` → ${item.link}` : ''}`)
    }
    lines.push('')
  }

  return {
    period,
    generatedAt: new Date().toISOString(),
    since: sinceIso,
    stats: {
      totalNotifications: recentNotifications.length,
      unreadNotifications: unreadNotifications.length,
      criticalNotifications: criticalNotifications.length,
      completedDelegations: completedDelegations.length,
      failedDelegations: failedDelegations.length,
      runningDelegations: runningDelegations.length,
      completedRuns: completedRuns.length,
      failedRuns: failedRuns.length,
      totalRunCostUsd,
    },
    sections: [notifSection, delegationSection, runSection],
    emailBody: lines.join('\n'),
  }
}
