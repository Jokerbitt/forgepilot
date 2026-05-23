import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { DailyReportExecuteLoopEvidenceRun } from './daily-report'

const DEFAULT_EVIDENCE_PATH = join(process.cwd(), 'config', 'execute-loop-evidence.json')
const MAX_NOTE_SEGMENTS = 6
const MAX_NOTE_LENGTH = 800

interface EvidenceFile {
  version: 1
  runs: DailyReportExecuteLoopEvidenceRun[]
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean'
}

function isEvidenceRun(value: unknown): value is DailyReportExecuteLoopEvidenceRun {
  if (!value || typeof value !== 'object') return false
  const run = value as Partial<DailyReportExecuteLoopEvidenceRun>
  return typeof run.id === 'string'
    && typeof run.title === 'string'
    && (run.status === 'success' || run.status === 'partial' || run.status === 'blocked')
    && (run.source === 'manual' || run.source === 'runtime-aggregate' || run.source === 'harness-dry-run')
    && typeof run.recordedAt === 'string'
    && Boolean(run.steps)
    && isBoolean(run.steps?.brief)
    && isBoolean(run.steps?.delegation)
    && isBoolean(run.steps?.execute)
    && isBoolean(run.steps?.tests)
    && isBoolean(run.steps?.pr)
    && isBoolean(run.steps?.critic)
    && isBoolean(run.steps?.writeback)
}

export function normalizeEvidenceNotes(notes?: string): string | undefined {
  if (!notes) return undefined

  const segments = notes
    .split('|')
    .map(segment => segment.trim())
    .filter(Boolean)

  const deduped: string[] = []
  for (const segment of segments) {
    if (!deduped.includes(segment)) deduped.push(segment)
    if (deduped.length >= MAX_NOTE_SEGMENTS) break
  }

  const compact = (deduped.length > 0 ? deduped : [notes.trim()])
    .join(' | ')
    .slice(0, MAX_NOTE_LENGTH)
    .trim()

  return compact.length > 0 ? compact : undefined
}

function normalizeEvidenceRun(run: DailyReportExecuteLoopEvidenceRun): DailyReportExecuteLoopEvidenceRun {
  return {
    ...run,
    title: run.title.slice(0, 160),
    notes: normalizeEvidenceNotes(run.notes),
    blocker: run.blocker?.slice(0, 500),
  }
}

export function readExecuteLoopEvidence(filePath = DEFAULT_EVIDENCE_PATH): DailyReportExecuteLoopEvidenceRun[] {
  if (!existsSync(filePath)) return []

  try {
    const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as Partial<EvidenceFile>
    if (!Array.isArray(parsed.runs)) return []
    return parsed.runs.filter(isEvidenceRun).map(normalizeEvidenceRun)
  } catch {
    return []
  }
}

export function writeExecuteLoopEvidence(
  runs: DailyReportExecuteLoopEvidenceRun[],
  filePath = DEFAULT_EVIDENCE_PATH,
): void {
  mkdirSync(dirname(filePath), { recursive: true })
  writeFileSync(filePath, JSON.stringify({ version: 1, runs: runs.map(normalizeEvidenceRun) }, null, 2) + '\n')
}

export function appendExecuteLoopEvidence(
  run: DailyReportExecuteLoopEvidenceRun,
  filePath = DEFAULT_EVIDENCE_PATH,
): DailyReportExecuteLoopEvidenceRun[] {
  const existing = readExecuteLoopEvidence(filePath).filter(item => item.id !== run.id)
  const next = [normalizeEvidenceRun(run), ...existing].slice(0, 25)
  writeExecuteLoopEvidence(next, filePath)
  return next
}
