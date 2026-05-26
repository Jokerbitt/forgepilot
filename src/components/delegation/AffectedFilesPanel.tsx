'use client'

import type { AgentLog, DelegationReport } from '@/lib/models/delegation'
import { cx } from '@/components/ui/primitives'

/** Max files shown before truncation */
const MAX_VISIBLE = 6

type FileChange = { path: string; kind: 'added' | 'modified' | 'deleted' | 'unknown' }

/** Extract file paths mentioned in log messages for running delegations. */
export function extractFilesFromLogs(logs: AgentLog[]): FileChange[] {
  const seen = new Set<string>()
  const result: FileChange[] = []

  for (const log of logs) {
    const msg = log.message

    // write_file / create_file → added
    const addMatch = msg.match(/(?:write_file|create_file|Created?)\s*[:\s]+([^\s'"]+\.[a-z]{1,6})/i)
    if (addMatch) {
      const path = normalizePath(addMatch[1])
      if (path && !seen.has(path)) { seen.add(path); result.push({ path, kind: 'added' }) }
    }

    // edit_file / updated / modified → modified
    const editMatch = msg.match(/(?:edit_file|update[sd]?|modif(?:ied|y))\s*[:\s]+([^\s'"]+\.[a-z]{1,6})/i)
    if (editMatch) {
      const path = normalizePath(editMatch[1])
      if (path && !seen.has(path)) { seen.add(path); result.push({ path, kind: 'modified' }) }
    }

    // delete_file / removed → deleted
    const delMatch = msg.match(/(?:delete_file|delet(?:ed|e)|remov(?:ed|e))\s*[:\s]+([^\s'"]+\.[a-z]{1,6})/i)
    if (delMatch) {
      const path = normalizePath(delMatch[1])
      if (path && !seen.has(path)) { seen.add(path); result.push({ path, kind: 'deleted' }) }
    }
  }

  return result
}

function normalizePath(raw: string): string {
  // Strip trailing punctuation, quotes, and clearly non-path characters
  return raw.replace(/[,;:'")\]>]+$/, '').trim()
}

/** Build file list from summaryReport (authoritative after completion). */
function filesFromReport(report: DelegationReport | undefined): FileChange[] {
  if (!report) return []
  const result: FileChange[] = []
  for (const f of report.filesAdded ?? []) result.push({ path: f, kind: 'added' })
  for (const f of report.filesModified ?? []) result.push({ path: f, kind: 'modified' })
  for (const f of report.filesDeleted ?? []) result.push({ path: f, kind: 'deleted' })
  // legacy changes array — treat as modified if not already listed
  const existingPaths = new Set(result.map(f => f.path))
  for (const f of report.changes ?? []) {
    if (!existingPaths.has(f)) result.push({ path: f, kind: 'unknown' })
  }
  return result
}

const kindIcon: Record<FileChange['kind'], string> = {
  added:    '+',
  modified: '~',
  deleted:  '−',
  unknown:  '·',
}

const kindColor: Record<FileChange['kind'], string> = {
  added:    'text-emerald-400',
  modified: 'text-amber-300',
  deleted:  'text-rose-400',
  unknown:  'text-slate-500',
}

interface AffectedFilesPanelProps {
  logs?: AgentLog[]
  summaryReport?: DelegationReport
  /** Whether the delegation is currently running (use log extraction if so) */
  isRunning?: boolean
  className?: string
}

export function AffectedFilesPanel({ logs, summaryReport, isRunning, className }: AffectedFilesPanelProps) {
  // Prefer authoritative report data; fall back to log extraction when running
  const files: FileChange[] = summaryReport && (
    (summaryReport.filesAdded?.length ?? 0) +
    (summaryReport.filesModified?.length ?? 0) +
    (summaryReport.filesDeleted?.length ?? 0) +
    (summaryReport.changes?.length ?? 0)
  ) > 0
    ? filesFromReport(summaryReport)
    : isRunning && logs
      ? extractFilesFromLogs(logs)
      : []

  if (files.length === 0) return null

  const visible = files.slice(0, MAX_VISIBLE)
  const overflow = files.length - visible.length

  return (
    <div className={cx('space-y-1', className)}>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
        {isRunning && !summaryReport?.filesModified?.length
          ? 'Dateien (aus Logs, live)'
          : 'Betroffene Dateien'}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {visible.map(({ path, kind }) => (
          <span
            key={path}
            title={path}
            className={cx(
              'inline-flex items-center gap-1 rounded border border-white/[0.06] bg-black/20 px-1.5 py-0.5 font-mono text-[10px]',
              kindColor[kind],
            )}
          >
            <span className="shrink-0 font-bold">{kindIcon[kind]}</span>
            <span className="max-w-[180px] truncate">{shortPath(path)}</span>
          </span>
        ))}
        {overflow > 0 && (
          <span className="rounded border border-white/[0.06] bg-black/20 px-1.5 py-0.5 text-[10px] text-slate-600">
            +{overflow} weitere
          </span>
        )}
      </div>
    </div>
  )
}

/** Show only the last 2 path segments for brevity: src/foo/bar.ts → foo/bar.ts */
function shortPath(p: string): string {
  const parts = p.replace(/\\/g, '/').split('/')
  return parts.length > 2 ? parts.slice(-2).join('/') : p
}
