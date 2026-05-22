import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { DailyReportExecuteLoopEvidenceRun } from './daily-report'

const DEFAULT_EVIDENCE_PATH = join(process.cwd(), 'config', 'execute-loop-evidence.json')

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
    && (run.source === 'manual' || run.source === 'runtime-aggregate')
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

export function readExecuteLoopEvidence(filePath = DEFAULT_EVIDENCE_PATH): DailyReportExecuteLoopEvidenceRun[] {
  if (!existsSync(filePath)) return []

  try {
    const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as Partial<EvidenceFile>
    if (!Array.isArray(parsed.runs)) return []
    return parsed.runs.filter(isEvidenceRun)
  } catch {
    return []
  }
}

export function writeExecuteLoopEvidence(
  runs: DailyReportExecuteLoopEvidenceRun[],
  filePath = DEFAULT_EVIDENCE_PATH,
): void {
  mkdirSync(dirname(filePath), { recursive: true })
  writeFileSync(filePath, JSON.stringify({ version: 1, runs }, null, 2) + '\n')
}

export function appendExecuteLoopEvidence(
  run: DailyReportExecuteLoopEvidenceRun,
  filePath = DEFAULT_EVIDENCE_PATH,
): DailyReportExecuteLoopEvidenceRun[] {
  const existing = readExecuteLoopEvidence(filePath).filter(item => item.id !== run.id)
  const next = [run, ...existing].slice(0, 25)
  writeExecuteLoopEvidence(next, filePath)
  return next
}
