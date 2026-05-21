import fs from 'fs'
import path from 'path'

const CONFIG_FILE = path.join(process.cwd(), 'config', 'telegram-config.json')

export type NotificationSeverityLevel = 'info' | 'warning' | 'critical'

export interface TelegramConfig {
  botToken: string
  chatId: string
  enabled: boolean
  notifyOnSeverity: NotificationSeverityLevel[]
}

const DEFAULT_SEVERITY: NotificationSeverityLevel[] = ['warning', 'critical']

export function readTelegramConfig(): TelegramConfig | null {
  try {
    if (!fs.existsSync(CONFIG_FILE)) return null
    const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8')) as TelegramConfig
    if (!cfg.botToken) return null
    return {
      botToken: cfg.botToken,
      chatId: cfg.chatId ?? '',
      enabled: cfg.enabled ?? false,
      notifyOnSeverity: cfg.notifyOnSeverity ?? DEFAULT_SEVERITY,
    }
  } catch {
    return null
  }
}

export function writeTelegramConfig(cfg: TelegramConfig): void {
  const dir = path.dirname(CONFIG_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const tmp = `${CONFIG_FILE}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2), 'utf-8')
  fs.renameSync(tmp, CONFIG_FILE)
}

export function isTelegramEnabled(): boolean {
  const cfg = readTelegramConfig()
  return cfg !== null && cfg.enabled && cfg.botToken.length > 0 && cfg.chatId.length > 0
}
