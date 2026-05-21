import fs from 'fs'
import path from 'path'
import type { Delegation } from '@/lib/models/delegation'
import { readTelegramConfig } from '@/lib/telegram/config'
import { readDelegations } from '@/lib/delegations/queue'
import { readNotifications, getUnreadCount } from '@/lib/notifications/notification-store'
import { getRuns } from '@/lib/agent-runs/store'
import { buildDigest } from '@/lib/digest/digest-builder'

export interface TelegramCallbackQuery {
  id: string
  from: { id: number; username?: string }
  message?: {
    message_id: number
    chat: { id: number }
    text?: string
  }
  /** callback_data from the button, e.g. "approve_abc123" or "reject_abc123" */
  data?: string
}

export interface TelegramUpdate {
  update_id: number
  message?: {
    message_id: number
    from: { id: number; username?: string }
    chat: { id: number }
    text?: string
    date: number
  }
  /** Button press from an inline keyboard */
  callback_query?: TelegramCallbackQuery
}

const DELEGATIONS_FILE = path.join(process.cwd(), 'config', 'delegations.json')

function writeDelegations(delegations: Delegation[]): void {
  const dir = path.dirname(DELEGATIONS_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const tmp = `${DELEGATIONS_FILE}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(delegations, null, 2), 'utf-8')
  fs.renameSync(tmp, DELEGATIONS_FILE)
}

function updateDelegationStatus(id: string, status: Delegation['status']): Delegation | null {
  const all = readDelegations()
  const idx = all.findIndex(d => d.id === id)
  if (idx < 0) return null
  all[idx] = { ...all[idx], status, updatedAt: new Date().toISOString() }
  writeDelegations(all)
  return all[idx]
}

function fmtCost(usd: number): string {
  if (usd === 0) return '–'
  if (usd < 0.01) return `$${(usd * 100).toFixed(3)}¢`
  return `$${usd.toFixed(4)}`
}

// ── Command handlers ──────────────────────────────────────────────────────────

function cmdHelp(): string {
  return `🤖 *ForgePilot Bot — Befehle*

/status — Überblick (Delegationen, Benachrichtigungen)
/runs — Letzte 5 Agent Runs
/digest — Aktivitäts-Zusammenfassung der letzten 24h
/approve \\<id\\> — Delegation genehmigen
/reject \\<id\\> — Delegation ablehnen
/notif — Letzte 5 ungelesene Benachrichtigungen
/help — Diese Hilfe`
}

function cmdStatus(): string {
  const delegations = readDelegations()
  const now = new Date()
  const todayCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  const pending = delegations.filter(d => d.status === 'pending').length
  const approved = delegations.filter(d => d.status === 'approved').length
  const running = delegations.filter(d => d.status === 'running').length
  const completedToday = delegations.filter(
    d => d.status === 'completed' && new Date(d.updatedAt) >= todayCutoff,
  ).length
  const failed = delegations.filter(d => d.status === 'failed').length
  const unread = getUnreadCount()

  return `📊 *ForgePilot Status*

🔴 Pending: ${pending}
🟡 Genehmigt: ${approved}
🟢 Laufend: ${running}
✅ Heute abgeschlossen: ${completedToday}
❌ Fehlgeschlagen: ${failed}
🔔 Ungelesene Benachrichtigungen: ${unread}`
}

function cmdRuns(): string {
  const runs = getRuns()
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .slice(0, 5)

  if (runs.length === 0) return 'ℹ️ Noch keine Agent Runs.'

  const lines = runs.map(r => {
    const statusEmoji = r.status === 'completed' ? '✅' : r.status === 'failed' ? '❌' : r.status === 'running' ? '🟢' : '⏳'
    const cost = r.totalCostUsd > 0 ? ` · ${fmtCost(r.totalCostUsd)}` : ''
    return `${statusEmoji} \`${r.id.slice(0, 8)}\` ${r.model}${cost}`
  })

  return `🤖 *Letzte Agent Runs*\n\n${lines.join('\n')}`
}

function cmdDigest(): string {
  try {
    const digest = buildDigest('daily')
    // Truncate for Telegram's 4096 char limit
    const body = digest.emailBody.slice(0, 3800)
    return `📋 *Aktivitäts-Digest (24h)*\n\n\`\`\`\n${body}\n\`\`\``
  } catch {
    return '❌ Digest konnte nicht erstellt werden.'
  }
}

function cmdApprove(id: string): string {
  if (!id) return '⚠️ Bitte ID angeben: /approve \\<id\\>'
  const d = updateDelegationStatus(id as Delegation['id'], 'approved')
  if (!d) return `❌ Delegation \`${id}\` nicht gefunden.`
  const title = (d.title ?? d.contract?.goal ?? id).slice(0, 60)
  return `✅ Delegation genehmigt: *${title}*`
}

function cmdReject(id: string): string {
  if (!id) return '⚠️ Bitte ID angeben: /reject \\<id\\>'
  const d = updateDelegationStatus(id as Delegation['id'], 'cancelled')
  if (!d) return `❌ Delegation \`${id}\` nicht gefunden.`
  const title = (d.title ?? d.contract?.goal ?? id).slice(0, 60)
  return `🚫 Delegation abgelehnt: *${title}*`
}

function cmdNotif(): string {
  const notifs = readNotifications()
    .filter(n => !n.read)
    .slice(0, 5)

  if (notifs.length === 0) return 'ℹ️ Keine ungelesenen Benachrichtigungen.'

  const lines = notifs.map(n => {
    const emoji = n.severity === 'critical' ? '🔴' : n.severity === 'warning' ? '⚠️' : 'ℹ️'
    return `${emoji} *${n.title}*\n${n.body.slice(0, 80)}`
  })

  return `🔔 *Ungelesene Benachrichtigungen*\n\n${lines.join('\n\n')}`
}

// ── Callback query handler (inline keyboard button presses) ──────────────────

export interface CallbackResult {
  /** Toast text shown in the Telegram client after button press */
  toast: string
  /** Updated message text to replace the original message */
  editedText: string
}

export function handleCallbackQuery(cbq: TelegramCallbackQuery): CallbackResult | null {
  const cfg = readTelegramConfig()
  if (!cfg) return null

  // Security: verify chat ID from callback_query
  const chatId = cbq.message?.chat.id.toString() ?? cbq.from.id.toString()
  if (chatId !== cfg.chatId) return null

  const data = cbq.data ?? ''

  if (data.startsWith('approve_')) {
    const id = data.slice('approve_'.length)
    const d = updateDelegationStatus(id as Delegation['id'], 'approved')
    if (!d) {
      return { toast: `Delegation ${id} nicht gefunden`, editedText: `❌ Delegation \`${id}\` nicht gefunden.` }
    }
    const title = (d.title ?? d.contract?.goal ?? id).slice(0, 60)
    return {
      toast: '✅ Genehmigt!',
      editedText: `✅ *Genehmigt:* ${title}\n_Aktion ausgeführt von Telegram_`,
    }
  }

  if (data.startsWith('reject_')) {
    const id = data.slice('reject_'.length)
    const d = updateDelegationStatus(id as Delegation['id'], 'cancelled')
    if (!d) {
      return { toast: `Delegation ${id} nicht gefunden`, editedText: `❌ Delegation \`${id}\` nicht gefunden.` }
    }
    const title = (d.title ?? d.contract?.goal ?? id).slice(0, 60)
    return {
      toast: '🚫 Abgelehnt',
      editedText: `🚫 *Abgelehnt:* ${title}\n_Aktion ausgeführt von Telegram_`,
    }
  }

  return null
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function handleTelegramUpdate(update: TelegramUpdate): Promise<string | null> {
  // Inline keyboard button press — handled separately by the webhook route
  if (update.callback_query) return null

  const msg = update.message
  if (!msg?.text) return null

  // Security: verify chat ID
  const cfg = readTelegramConfig()
  if (!cfg || msg.chat.id.toString() !== cfg.chatId) {
    return '⛔ Unauthorized'
  }

  const text = msg.text.trim()
  if (!text.startsWith('/')) return null

  const [rawCmd, ...args] = text.split(/\s+/)
  const cmd = rawCmd.toLowerCase()

  switch (cmd) {
    case '/help':     return cmdHelp()
    case '/status':   return cmdStatus()
    case '/runs':     return cmdRuns()
    case '/digest':   return cmdDigest()
    case '/approve':  return cmdApprove(args[0] ?? '')
    case '/reject':   return cmdReject(args[0] ?? '')
    case '/notif':    return cmdNotif()
    default:          return '❓ Unbekannter Befehl\\. Sende /help für alle Befehle\\.'
  }
}
