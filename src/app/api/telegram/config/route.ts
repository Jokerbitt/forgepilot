export const dynamic = 'force-dynamic'
import { type NextRequest, NextResponse } from 'next/server'
import { readTelegramConfig, writeTelegramConfig } from '@/lib/telegram/config'
import type { TelegramConfig, NotificationSeverityLevel } from '@/lib/telegram/config'
import { parseBody, isValidationError } from '@/lib/validation/api'
import { TelegramConfigSchema } from '@/lib/validation/schemas'

function maskToken(token: string): string {
  if (token.length <= 6) return '••••••'
  return `••••••${token.slice(-6)}`
}

export function GET() {
  const cfg = readTelegramConfig()
  if (!cfg) {
    return NextResponse.json({
      botToken: '',
      chatId: '',
      enabled: false,
      notifyOnSeverity: ['warning', 'critical'],
      configured: false,
    })
  }
  return NextResponse.json({
    botToken: maskToken(cfg.botToken),
    chatId: cfg.chatId,
    enabled: cfg.enabled,
    notifyOnSeverity: cfg.notifyOnSeverity,
    configured: true,
  })
}

export async function POST(req: NextRequest) {
  try {
    const bodyResult = await parseBody(req, TelegramConfigSchema)
    if (isValidationError(bodyResult)) return bodyResult
    const body = bodyResult as { botToken?: string; chatId?: string; enabled?: boolean; notifyOnSeverity?: string[] }

    // Load existing to preserve token if masked placeholder is submitted
    const existing = readTelegramConfig()
    const existingToken = existing?.botToken ?? ''

    // If body.botToken is empty or looks like a mask (only bullets), keep existing
    const isNewToken = body.botToken && body.botToken.length > 0 && !body.botToken.startsWith('••••••')
    const resolvedToken = isNewToken ? body.botToken! : existingToken

    const validSeverities: NotificationSeverityLevel[] = ['info', 'warning', 'critical']
    const notifyOnSeverity: NotificationSeverityLevel[] = (body.notifyOnSeverity ?? ['warning', 'critical'])
      .filter((s): s is NotificationSeverityLevel => validSeverities.includes(s as NotificationSeverityLevel))

    const cfg: TelegramConfig = {
      botToken: resolvedToken,
      chatId: body.chatId ?? existing?.chatId ?? '',
      enabled: body.enabled ?? false,
      notifyOnSeverity: notifyOnSeverity.length > 0 ? notifyOnSeverity : ['warning', 'critical'],
    }

    writeTelegramConfig(cfg)
    return NextResponse.json({ ok: true, configured: resolvedToken.length > 0 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
