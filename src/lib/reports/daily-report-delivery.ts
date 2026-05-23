import { createHmac } from 'crypto'
import type { DailyReport } from './daily-report'
import { scrubSecrets } from './scrub-secrets'

export type DailyReportDeliveryFormat = 'json' | 'markdown'

export interface DailyReportDeliveryTarget {
  /** Absolute HTTPS/HTTP URL the report should be POSTed to (e.g. n8n webhook). */
  url: string
  /** Payload format the receiver expects. Defaults to JSON. */
  format?: DailyReportDeliveryFormat
  /** Optional shared secret used to compute the HMAC-SHA256 signature header. */
  secret?: string
  /** Optional extra headers merged into the request. */
  headers?: Record<string, string>
}

export interface DailyReportDeliveryOptions {
  /** Maximum number of attempts (initial + retries). Defaults to 3. */
  maxAttempts?: number
  /** Base delay in ms between retries (linear backoff: delay * attempt). Defaults to 250. */
  retryDelayMs?: number
  /** Inject a custom fetch implementation. Defaults to globalThis.fetch. */
  fetchImpl?: typeof fetch
  /** Inject a delay function. Defaults to setTimeout-based sleep. */
  sleep?: (ms: number) => Promise<void>
}

export interface DailyReportDeliveryAttempt {
  attempt: number
  status: number | null
  ok: boolean
  error?: string
}

export interface DailyReportDeliveryResult {
  ok: boolean
  url: string
  format: DailyReportDeliveryFormat
  attempts: DailyReportDeliveryAttempt[]
  deliveredAt: string
  signature?: string
}

const SIGNATURE_HEADER = 'x-forgepilot-signature'
const DEFAULT_MAX_ATTEMPTS = 3
const DEFAULT_RETRY_DELAY_MS = 250

function defaultSleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function signPayload(payload: string, secret: string): string {
  const digest = createHmac('sha256', secret).update(payload, 'utf8').digest('hex')
  return `sha256=${digest}`
}

function buildPayload(
  report: DailyReport,
  format: DailyReportDeliveryFormat,
): { body: string; contentType: string } {
  if (format === 'markdown') {
    return {
      body: scrubSecrets(report.markdown),
      contentType: 'text/markdown; charset=utf-8',
    }
  }
  const safeReport: DailyReport = {
    ...report,
    markdown: scrubSecrets(report.markdown),
  }
  return {
    body: JSON.stringify(safeReport),
    contentType: 'application/json',
  }
}

export async function deliverDailyReport(
  report: DailyReport,
  target: DailyReportDeliveryTarget,
  options: DailyReportDeliveryOptions = {},
): Promise<DailyReportDeliveryResult> {
  if (!target.url || !/^https?:\/\//i.test(target.url)) {
    throw new Error('deliverDailyReport: target.url must be an absolute http(s) URL')
  }

  const format: DailyReportDeliveryFormat = target.format ?? 'json'
  const maxAttempts = Math.max(1, options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS)
  const retryDelayMs = Math.max(0, options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS)
  const fetchImpl = options.fetchImpl ?? globalThis.fetch
  const sleep = options.sleep ?? defaultSleep

  if (typeof fetchImpl !== 'function') {
    throw new Error('deliverDailyReport: no fetch implementation available')
  }

  const { body, contentType } = buildPayload(report, format)
  const signature = target.secret ? signPayload(body, target.secret) : undefined

  const headers: Record<string, string> = {
    'content-type': contentType,
    'user-agent': 'forgepilot-daily-report/1',
    ...(target.headers ?? {}),
  }
  if (signature) {
    headers[SIGNATURE_HEADER] = signature
  }

  const attempts: DailyReportDeliveryAttempt[] = []

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetchImpl(target.url, {
        method: 'POST',
        headers,
        body,
      })
      const ok = response.ok
      attempts.push({ attempt, status: response.status, ok })
      if (ok) {
        return {
          ok: true,
          url: target.url,
          format,
          attempts,
          deliveredAt: new Date().toISOString(),
          signature,
        }
      }
    } catch (error) {
      attempts.push({
        attempt,
        status: null,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      })
    }

    if (attempt < maxAttempts) {
      await sleep(retryDelayMs * attempt)
    }
  }

  return {
    ok: false,
    url: target.url,
    format,
    attempts,
    deliveredAt: new Date().toISOString(),
    signature,
  }
}

export interface DailyReportDeliveryEnvTarget {
  configured: boolean
  target?: DailyReportDeliveryTarget
}

/**
 * Read a default delivery target from environment variables.
 * - FORGEPILOT_DAILY_REPORT_WEBHOOK_URL: required to enable delivery
 * - FORGEPILOT_DAILY_REPORT_WEBHOOK_SECRET: optional HMAC secret
 * - FORGEPILOT_DAILY_REPORT_WEBHOOK_FORMAT: 'json' (default) or 'markdown'
 */
export function readDailyReportDeliveryTargetFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): DailyReportDeliveryEnvTarget {
  const url = env.FORGEPILOT_DAILY_REPORT_WEBHOOK_URL?.trim()
  if (!url) {
    return { configured: false }
  }
  const formatRaw = env.FORGEPILOT_DAILY_REPORT_WEBHOOK_FORMAT?.trim().toLowerCase()
  const format: DailyReportDeliveryFormat = formatRaw === 'markdown' ? 'markdown' : 'json'
  const secret = env.FORGEPILOT_DAILY_REPORT_WEBHOOK_SECRET?.trim() || undefined

  return {
    configured: true,
    target: { url, format, secret },
  }
}
