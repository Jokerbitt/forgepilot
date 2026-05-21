/**
 * Telegram Daily Digest — Vercel Cron Job — M152
 *
 * Sends the daily activity digest to the configured Telegram chat.
 * Called at 07:00 UTC every morning by Vercel Cron.
 *
 * Security: validates Authorization header (CRON_SECRET) just like retention cron.
 * Cron schedule: 0 7 * * * (daily at 07:00 UTC)
 */

import { type NextRequest, NextResponse } from 'next/server'
import { buildDigest } from '@/lib/digest/digest-builder'
import { isTelegramEnabled, readTelegramConfig } from '@/lib/telegram/config'
import { sendTelegramMessage } from '@/lib/telegram/bot'
import { logger } from '@/lib/logger'
import { isCronAuthorized } from '@/lib/cron/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const cronLogger = logger.child({ module: 'cron.telegram-digest' })

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Validate Vercel Cron authorization
  if (!isCronAuthorized(request, 'telegram-digest')) {
    cronLogger.warn({ event: 'cron.telegram_digest.unauthorized' })
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isTelegramEnabled()) {
    cronLogger.info({ event: 'cron.telegram_digest.skipped', reason: 'telegram_disabled' })
    return NextResponse.json({ ok: false, skipped: true, reason: 'Telegram not configured' })
  }

  const cfg = readTelegramConfig()
  if (!cfg) {
    return NextResponse.json({ ok: false, skipped: true, reason: 'No Telegram config' })
  }

  try {
    cronLogger.info({ event: 'cron.telegram_digest.start' })
    const digest = buildDigest('daily')

    const lines: string[] = [
      `📊 *ForgePilot Tages-Digest*`,
      `_${new Date().toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}_`,
      '',
      `📬 Benachrichtigungen: ${digest.stats.totalNotifications} gesamt, ${digest.stats.unreadNotifications} ungelesen`,
      `⚠️ Kritisch: ${digest.stats.criticalNotifications}`,
      '',
      `🤖 Delegierungen: ✅ ${digest.stats.completedDelegations} abgeschlossen · ❌ ${digest.stats.failedDelegations} fehlgeschlagen · ▶️ ${digest.stats.runningDelegations} laufend`,
      `🔄 Agent-Runs: ✅ ${digest.stats.completedRuns} · ❌ ${digest.stats.failedRuns}`,
    ]

    if (digest.stats.totalRunCostUsd > 0) {
      lines.push(`💰 Gesamtkosten: $${digest.stats.totalRunCostUsd.toFixed(4)}`)
    }

    if (digest.sections.length > 0) {
      lines.push('')
      for (const section of digest.sections) {
        if (section.items.length > 0) {
          lines.push(`*${section.title}*`)
          for (const item of section.items.slice(0, 5)) {
            lines.push(`• ${item.label}${item.value ? ': ' + item.value : ''}`)
          }
          if (section.items.length > 5) {
            lines.push(`  _(+${section.items.length - 5} weitere)_`)
          }
        }
      }
    }

    lines.push('')
    lines.push(`🔗 [ForgePilot öffnen](${process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'}/digest)`)

    const text = lines.join('\n')
    const ok = await sendTelegramMessage(text, { parseMode: 'Markdown', disableWebPagePreview: true })

    cronLogger.info({ event: 'cron.telegram_digest.complete', ok })
    return NextResponse.json({ ok, ranAt: new Date().toISOString(), period: 'daily' })
  } catch (err) {
    cronLogger.error({
      event: 'cron.telegram_digest.error',
      error: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json({ error: 'Failed to send digest' }, { status: 500 })
  }
}
