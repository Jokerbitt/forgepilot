import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import type { ProjectBrief } from '@/lib/models/project-brief'

const VERSIONS_FILE = path.join(process.cwd(), 'config', 'brief-versions.json')
const MAX_VERSIONS_PER_BRIEF = 20

export interface BriefVersion {
  versionId: string
  briefId: string
  /** Incrementing version number (1 = oldest). */
  versionNumber: number
  snapshot: ProjectBrief
  savedAt: string
  label?: string
}

function readAll(): BriefVersion[] {
  try {
    return JSON.parse(fs.readFileSync(VERSIONS_FILE, 'utf-8')) as BriefVersion[]
  } catch {
    return []
  }
}

function writeAll(versions: BriefVersion[]): void {
  const dir = path.dirname(VERSIONS_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const tmp = `${VERSIONS_FILE}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(versions, null, 2), 'utf-8')
  fs.renameSync(tmp, VERSIONS_FILE)
}

export function getBriefVersions(briefId: string): BriefVersion[] {
  return readAll()
    .filter(v => v.briefId === briefId)
    .sort((a, b) => b.versionNumber - a.versionNumber)
}

export function getBriefVersion(briefId: string, versionId: string): BriefVersion | null {
  return readAll().find(v => v.briefId === briefId && v.versionId === versionId) ?? null
}

/** Snapshot the brief's current state before a PATCH is applied. */
export function saveSnapshot(brief: ProjectBrief, label?: string): BriefVersion {
  const all = readAll()
  const existing = all.filter(v => v.briefId === brief.id)
  const versionNumber = (existing.length === 0 ? 0 : Math.max(...existing.map(v => v.versionNumber))) + 1

  const version: BriefVersion = {
    versionId: randomUUID(),
    briefId: brief.id,
    versionNumber,
    snapshot: { ...brief },
    savedAt: new Date().toISOString(),
    label,
  }

  // Trim to max versions
  const kept = existing.slice(0, MAX_VERSIONS_PER_BRIEF - 1)
  const others = all.filter(v => v.briefId !== brief.id)
  writeAll([...others, ...kept, version])

  return version
}

// ─── Diff helpers ──────────────────────────────────────────────────────────

export interface FieldDiff {
  field: string
  label: string
  before: string
  after: string
  changed: boolean
}

const DIFFABLE_FIELDS: Array<{ key: keyof ProjectBrief; label: string }> = [
  { key: 'title', label: 'Titel' },
  { key: 'rawIdea', label: 'Idee' },
  { key: 'problemStatement', label: 'Problem-Statement' },
  { key: 'targetAudience', label: 'Zielgruppe' },
  { key: 'desiredOutcome', label: 'Gewünschtes Ergebnis' },
  { key: 'notes', label: 'Notizen' },
  { key: 'status', label: 'Status' },
  { key: 'scope', label: 'Umfang' },
]

function stringify(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  return JSON.stringify(value)
}

export function diffBriefs(before: ProjectBrief, after: ProjectBrief): FieldDiff[] {
  const diffs: FieldDiff[] = []

  for (const { key, label } of DIFFABLE_FIELDS) {
    const b = stringify(before[key])
    const a = stringify(after[key])
    diffs.push({ field: key, label, before: b, after: a, changed: b !== a })
  }

  // Requirements diff (count + changed items)
  const reqBefore = (before.requirements ?? []).map(r => r.title).join('\n')
  const reqAfter = (after.requirements ?? []).map(r => r.title).join('\n')
  diffs.push({ field: 'requirements', label: 'Anforderungen', before: reqBefore, after: reqAfter, changed: reqBefore !== reqAfter })

  // Constraints diff
  const cBefore = (before.constraints ?? []).join('\n')
  const cAfter = (after.constraints ?? []).join('\n')
  diffs.push({ field: 'constraints', label: 'Constraints', before: cBefore, after: cAfter, changed: cBefore !== cAfter })

  return diffs
}
