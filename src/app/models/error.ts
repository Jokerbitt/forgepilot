/**
 * Error Information Model
 *
 * Captures structured error metadata that surfaces in ForgePilot so the operator
 * (and downstream automation) can react to failures from agents, delegations,
 * pipelines, and webhooks. Persistence is append-style with an upper bound so
 * the store cannot grow unbounded on a long-running NAS deployment.
 *
 * Storage:
 *   - file: `config/error-log.json`
 *   - retention: last MAX_ERRORS entries (default 500), trimmed on every write
 *   - writes are atomic (tmp → rename) to survive a NAS power loss
 */

import fs from 'fs'
import path from 'path'
import { getDataDir } from '@/lib/config/paths'

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical'
export type ErrorSource =
  | 'agent'
  | 'delegation'
  | 'pipeline'
  | 'webhook'
  | 'api'
  | 'orchestration'
  | 'unknown'

export interface ErrorInfo {
  id: string
  message: string
  severity: ErrorSeverity
  source: ErrorSource
  occurredAt: string
  stack?: string
  /** Foreign key to a domain entity that produced the error */
  relatedId?: string
  /** Structured context — request ids, model name, retry counts, etc. */
  context?: Record<string, unknown>
  resolved?: boolean
}

interface ErrorStore {
  errors: ErrorInfo[]
  updatedAt: string
}

const MAX_ERRORS = 500
const STORE_FILENAME = 'error-log.json'

export interface CreateErrorInfoInput {
  message: string
  severity?: ErrorSeverity
  source?: ErrorSource
  stack?: string
  relatedId?: string
  context?: Record<string, unknown>
  occurredAt?: string
}

function genId(): string {
  return `err-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function getErrorFile(override?: string): string {
  return override ?? path.join(getDataDir(), STORE_FILENAME)
}

function readStore(file?: string): ErrorStore {
  const p = getErrorFile(file)
  try {
    if (!fs.existsSync(p)) return { errors: [], updatedAt: new Date().toISOString() }
    const raw = fs.readFileSync(p, 'utf-8')
    const parsed: unknown = JSON.parse(raw)
    if (!isErrorStore(parsed)) {
      return { errors: [], updatedAt: new Date().toISOString() }
    }
    return parsed
  } catch {
    return { errors: [], updatedAt: new Date().toISOString() }
  }
}

function writeStore(store: ErrorStore, file?: string): void {
  const p = getErrorFile(file)
  const dir = path.dirname(p)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const tmp = `${p}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2), 'utf-8')
  fs.renameSync(tmp, p)
}

function isErrorStore(value: unknown): value is ErrorStore {
  if (typeof value !== 'object' || value === null) return false
  const v = value as { errors?: unknown; updatedAt?: unknown }
  return Array.isArray(v.errors) && typeof v.updatedAt === 'string'
}

// ─── Public API ─────────────────────────────────────────────────────────────

/** Build a normalised ErrorInfo object without persisting it. */
export function createErrorInfo(input: CreateErrorInfoInput): ErrorInfo {
  const error: ErrorInfo = {
    id: genId(),
    message: input.message,
    severity: input.severity ?? 'medium',
    source: input.source ?? 'unknown',
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    ...(input.stack ? { stack: input.stack } : {}),
    ...(input.relatedId ? { relatedId: input.relatedId } : {}),
    ...(input.context ? { context: input.context } : {}),
  }
  return error
}

/** Persist an ErrorInfo to the JSON store. Returns the persisted record. */
export function storeErrorInfo(error: ErrorInfo, file?: string): ErrorInfo {
  const store = readStore(file)
  store.errors.unshift(error)
  if (store.errors.length > MAX_ERRORS) {
    store.errors = store.errors.slice(0, MAX_ERRORS)
  }
  store.updatedAt = new Date().toISOString()
  writeStore(store, file)
  return error
}

/** Shortcut: build + persist in one call. */
export function recordErrorInfo(input: CreateErrorInfoInput, file?: string): ErrorInfo {
  return storeErrorInfo(createErrorInfo(input), file)
}

export interface ErrorListFilter {
  source?: ErrorSource
  severity?: ErrorSeverity
  /** Inclusive ISO lower bound — only errors at or after this timestamp. */
  since?: string
  resolved?: boolean
  limit?: number
}

export function listErrorInfo(filter: ErrorListFilter = {}, file?: string): ErrorInfo[] {
  let errors = readStore(file).errors
  if (filter.source) errors = errors.filter(e => e.source === filter.source)
  if (filter.severity) errors = errors.filter(e => e.severity === filter.severity)
  if (filter.resolved !== undefined) {
    errors = errors.filter(e => (e.resolved ?? false) === filter.resolved)
  }
  if (filter.since) {
    const cutoff = new Date(filter.since).getTime()
    errors = errors.filter(e => new Date(e.occurredAt).getTime() >= cutoff)
  }
  if (filter.limit && filter.limit > 0) errors = errors.slice(0, filter.limit)
  return errors
}

export function getErrorInfo(id: string, file?: string): ErrorInfo | null {
  return readStore(file).errors.find(e => e.id === id) ?? null
}

/** Test helper — clears the store. NOT for production code paths. */
export function _clearErrorStore(file?: string): void {
  writeStore({ errors: [], updatedAt: new Date().toISOString() }, file)
}
