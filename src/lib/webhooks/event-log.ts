/**
 * Webhook Event Log — M135
 *
 * Append-only audit log of every webhook ForgePilot receives. Sits BEHIND
 * the existing webhook handlers (`/api/webhooks/linear`, `/api/webhooks/intake`,
 * future `/api/webhooks/n8n`) — those routes call `recordWebhookEvent()` after
 * they finish processing, so the user gets a single page in
 * `/settings/webhooks` showing what came in, whether it succeeded, and a
 * replay button for the bodies that failed.
 *
 * Storage:
 *   - file: `config/webhook-events.json`
 *   - retention: last MAX_EVENTS entries (default 500), trimmed on every write
 *
 * The lib is intentionally pure — it does not import Next.js, fetch, or any
 * route handler. That means it can be tested in isolation and the consuming
 * webhook routes only need a single line:
 *
 *     recordWebhookEvent({ source: 'linear', status: 'processed', … })
 */

import fs from 'fs'
import path from 'path'
import { getDataDir } from '@/lib/config/paths'

export type WebhookSource = 'linear' | 'intake' | 'n8n' | 'github' | 'sentry' | 'other'
export type WebhookStatus = 'processed' | 'ignored' | 'skipped' | 'failed' | 'invalid-signature'

export interface WebhookEvent {
  id: string
  source: WebhookSource
  receivedAt: string
  status: WebhookStatus
  /** Short human-readable summary — e.g. "delegation-created JOK-184" */
  summary: string
  /** Filled in when `status === 'failed'`. */
  errorMessage?: string
  /** HTTP method, default POST */
  method?: string
  /** Optional foreign key to a domain entity created by the webhook */
  delegationId?: string
  workItemId?: string
  /** Raw body — kept so the operator can replay the request. Capped to MAX_BODY_BYTES. */
  rawBody?: string
  /** Headers worth preserving — only safelisted keys are kept */
  headers?: Record<string, string>
  /** Round-trip processing time in ms */
  durationMs?: number
}

interface EventStore {
  events: WebhookEvent[]
  updatedAt: string
}

const MAX_EVENTS = 500
const MAX_BODY_BYTES = 64 * 1024 // 64 KB raw body cap

// Header allowlist — we keep diagnostically useful ones, drop secrets.
const SAFE_HEADER_KEYS = new Set([
  'content-type',
  'user-agent',
  'x-forwarded-for',
  'x-real-ip',
  'x-github-event',
  'x-github-delivery',
  'linear-event',
  'linear-delivery',
  'x-n8n-signature',
  'x-request-id',
])

function getEventsFile(override?: string): string {
  return override ?? path.join(getDataDir(), 'webhook-events.json')
}

function readStore(file?: string): EventStore {
  const p = getEventsFile(file)
  try {
    if (!fs.existsSync(p)) return { events: [], updatedAt: new Date().toISOString() }
    return JSON.parse(fs.readFileSync(p, 'utf-8')) as EventStore
  } catch {
    return { events: [], updatedAt: new Date().toISOString() }
  }
}

function writeStore(store: EventStore, file?: string): void {
  const p = getEventsFile(file)
  const dir = path.dirname(p)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const tmp = p + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2), 'utf-8')
  fs.renameSync(tmp, p)
}

function trimBody(body: string | undefined): string | undefined {
  if (!body) return undefined
  if (body.length <= MAX_BODY_BYTES) return body
  return body.slice(0, MAX_BODY_BYTES) + `…[truncated ${body.length - MAX_BODY_BYTES} bytes]`
}

function pickHeaders(headers: Record<string, string> | undefined): Record<string, string> | undefined {
  if (!headers) return undefined
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(headers)) {
    if (SAFE_HEADER_KEYS.has(k.toLowerCase())) {
      out[k.toLowerCase()] = v
    }
  }
  return Object.keys(out).length > 0 ? out : undefined
}

function genId(): string {
  return `whk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

// ─── Public API ─────────────────────────────────────────────────────────────

export interface RecordWebhookInput {
  source: WebhookSource
  status: WebhookStatus
  summary: string
  errorMessage?: string
  method?: string
  delegationId?: string
  workItemId?: string
  rawBody?: string
  headers?: Record<string, string>
  durationMs?: number
}

/** Append a webhook event to the log. Returns the persisted record. */
export function recordWebhookEvent(input: RecordWebhookInput, file?: string): WebhookEvent {
  const store = readStore(file)
  const event: WebhookEvent = {
    id: genId(),
    receivedAt: new Date().toISOString(),
    source: input.source,
    status: input.status,
    summary: input.summary,
    method: input.method ?? 'POST',
    ...(input.errorMessage ? { errorMessage: input.errorMessage } : {}),
    ...(input.delegationId ? { delegationId: input.delegationId } : {}),
    ...(input.workItemId ? { workItemId: input.workItemId } : {}),
    ...(input.durationMs !== undefined ? { durationMs: input.durationMs } : {}),
    ...(input.rawBody ? { rawBody: trimBody(input.rawBody) } : {}),
    ...(input.headers ? { headers: pickHeaders(input.headers) } : {}),
  }

  store.events.unshift(event) // newest first
  if (store.events.length > MAX_EVENTS) {
    store.events = store.events.slice(0, MAX_EVENTS)
  }
  store.updatedAt = new Date().toISOString()
  writeStore(store, file)
  return event
}

export interface ListFilter {
  source?: WebhookSource
  status?: WebhookStatus
  /** Inclusive ISO lower bound — only events at or after this timestamp. */
  since?: string
  limit?: number
}

export function listWebhookEvents(filter: ListFilter = {}, file?: string): WebhookEvent[] {
  let events = readStore(file).events
  if (filter.source) events = events.filter(e => e.source === filter.source)
  if (filter.status) events = events.filter(e => e.status === filter.status)
  if (filter.since) {
    const cutoff = new Date(filter.since).getTime()
    events = events.filter(e => new Date(e.receivedAt).getTime() >= cutoff)
  }
  if (filter.limit && filter.limit > 0) events = events.slice(0, filter.limit)
  return events
}

export function getWebhookEvent(id: string, file?: string): WebhookEvent | null {
  return readStore(file).events.find(e => e.id === id) ?? null
}

export interface WebhookStats {
  total: number
  bySource: Record<WebhookSource, number>
  byStatus: Record<WebhookStatus, number>
  lastReceivedAt?: string
}

function emptyBySource(): Record<WebhookSource, number> {
  return { linear: 0, intake: 0, n8n: 0, github: 0, sentry: 0, other: 0 }
}

function emptyByStatus(): Record<WebhookStatus, number> {
  return { processed: 0, ignored: 0, skipped: 0, failed: 0, 'invalid-signature': 0 }
}

export function getWebhookStats(file?: string): WebhookStats {
  const events = readStore(file).events
  const bySource = emptyBySource()
  const byStatus = emptyByStatus()
  for (const e of events) {
    bySource[e.source] += 1
    byStatus[e.status] += 1
  }
  return {
    total: events.length,
    bySource,
    byStatus,
    lastReceivedAt: events[0]?.receivedAt,
  }
}

/** Test helper — clears the store. NOT for production code paths. */
export function _clearWebhookLog(file?: string): void {
  writeStore({ events: [], updatedAt: new Date().toISOString() }, file)
}
