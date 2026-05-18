import fs from 'fs'
import path from 'path'
import type { PMAgentResult } from './pm-agent'

const PM_HISTORY_FILE = path.join(process.cwd(), 'config', 'pm-history.json')
const MAX_HISTORY_ENTRIES = 10

export function readPMHistory(): PMAgentResult[] {
  try {
    return JSON.parse(fs.readFileSync(PM_HISTORY_FILE, 'utf-8')) as PMAgentResult[]
  } catch {
    return []
  }
}

export function appendPMHistory(result: PMAgentResult): void {
  const history = readPMHistory()
  // Prepend new result (newest first), then cap at max
  const updated = [result, ...history].slice(0, MAX_HISTORY_ENTRIES)
  const tmp = PM_HISTORY_FILE + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(updated, null, 2), 'utf-8')
  fs.renameSync(tmp, PM_HISTORY_FILE)
}
