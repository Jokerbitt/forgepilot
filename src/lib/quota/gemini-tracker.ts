/**
 * Gemini Free Tier Quota Tracker
 * Persists daily call counts in config/gemini-quota.json.
 * Auto-rotates: keeps only the last 7 days.
 */

import fs from 'fs'
import path from 'path'

export interface QuotaEntry {
  date: string
  calls: number
}

export interface QuotaStore {
  entries: QuotaEntry[]
  lastUpdated: string
}

export interface GeminiQuotaStatus {
  today: number
  limit: number
  percentage: number
  resetAt: string
}

const QUOTA_FILE = path.join(process.cwd(), 'config', 'gemini-quota.json')
const DAILY_LIMIT = 1500
const RETENTION_DAYS = 7

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10)
}

function tomorrowMidnightUTC(): string {
  const tomorrow = new Date()
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  tomorrow.setUTCHours(0, 0, 0, 0)
  return tomorrow.toISOString()
}

function cutoffDate(): string {
  const cutoff = new Date()
  cutoff.setUTCDate(cutoff.getUTCDate() - RETENTION_DAYS)
  return cutoff.toISOString().slice(0, 10)
}

function readStore(): QuotaStore {
  try {
    const raw = fs.readFileSync(QUOTA_FILE, 'utf-8')
    return JSON.parse(raw) as QuotaStore
  } catch {
    return { entries: [], lastUpdated: new Date().toISOString() }
  }
}

function writeStore(store: QuotaStore): void {
  const dir = path.dirname(QUOTA_FILE)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.writeFileSync(QUOTA_FILE, JSON.stringify(store, null, 2), 'utf-8')
}

function rotateEntries(entries: QuotaEntry[]): QuotaEntry[] {
  const cutoff = cutoffDate()
  return entries.filter(e => e.date >= cutoff)
}

export function incrementGeminiCall(): void {
  const store = readStore()
  const today = todayUTC()
  const existing = store.entries.find(e => e.date === today)
  if (existing) {
    existing.calls += 1
  } else {
    store.entries.push({ date: today, calls: 1 })
  }
  store.entries = rotateEntries(store.entries)
  store.lastUpdated = new Date().toISOString()
  writeStore(store)
}

export function getGeminiQuota(): GeminiQuotaStatus {
  const store = readStore()
  const today = todayUTC()
  const entry = store.entries.find(e => e.date === today)
  const todayCalls = entry?.calls ?? 0
  const percentage = Math.round((todayCalls / DAILY_LIMIT) * 100)
  return {
    today: todayCalls,
    limit: DAILY_LIMIT,
    percentage,
    resetAt: tomorrowMidnightUTC(),
  }
}

export function getGeminiQuotaHistory(): QuotaEntry[] {
  const store = readStore()
  return rotateEntries(store.entries).sort((a, b) => a.date.localeCompare(b.date))
}
