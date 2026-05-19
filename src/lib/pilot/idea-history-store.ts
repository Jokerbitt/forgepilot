/**
 * Idea History Store
 *
 * Tracks every idea submitted through the Idea → Production pipeline.
 * Persisted to config/idea-history.json.
 */

import fs from 'fs'
import path from 'path'

const HISTORY_FILE = path.join(process.cwd(), 'config', 'idea-history.json')

export interface IdeaHistoryEntry {
  id: string
  idea: string
  briefId: string
  briefTitle: string
  runId: string
  workItemCount: number
  taskCount: number
  /** Status is derived at read-time by checking the run store, or stored directly */
  status: 'building' | 'running' | 'done' | 'failed'
  createdAt: string
}

function read(): IdeaHistoryEntry[] {
  try {
    if (!fs.existsSync(HISTORY_FILE)) return []
    return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8')) as IdeaHistoryEntry[]
  } catch {
    return []
  }
}

function write(entries: IdeaHistoryEntry[]): void {
  const dir = path.dirname(HISTORY_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const tmp = HISTORY_FILE + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(entries, null, 2), 'utf-8')
  fs.renameSync(tmp, HISTORY_FILE)
}

export function appendIdeaHistory(entry: IdeaHistoryEntry): void {
  const entries = read()
  entries.unshift(entry)
  // Keep only the last 50 entries
  write(entries.slice(0, 50))
}

export function readIdeaHistory(limit = 10): IdeaHistoryEntry[] {
  return read().slice(0, limit)
}

export function updateIdeaHistoryStatus(runId: string, status: IdeaHistoryEntry['status']): void {
  const entries = read()
  const idx = entries.findIndex(e => e.runId === runId)
  if (idx !== -1) {
    entries[idx] = { ...entries[idx], status }
    write(entries)
  }
}
