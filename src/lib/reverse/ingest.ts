/**
 * Reverse-Engineering — Slice 3: safe ingest of an uploaded ZIP.
 *
 * Extracts an uploaded archive into an isolated temp workspace so Slice 1/2 can
 * analyze it. Security is the whole point here:
 * - path-traversal guard: every entry must resolve INSIDE the workspace,
 * - hard caps: max entries + max total uncompressed bytes (zip-bomb guard),
 * - directory entries and absolute paths are rejected,
 * - nothing is executed; we only write files.
 *
 * Uses jszip (pure JS, already a dependency) — no shell, no native unzip.
 */
import JSZip from 'jszip'
import { mkdtempSync, mkdirSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join, dirname, normalize, isAbsolute, sep } from 'path'

export interface IngestLimits {
  maxEntries: number
  maxTotalBytes: number
}

export const DEFAULT_INGEST_LIMITS: IngestLimits = {
  maxEntries: 5000,
  maxTotalBytes: 100 * 1024 * 1024, // 100 MB uncompressed
}

export interface IngestResult {
  /** Absolute path to the isolated workspace the ZIP was extracted into. */
  workspacePath: string
  /** Number of files written. */
  fileCount: number
  /** Total uncompressed bytes written. */
  totalBytes: number
}

export class IngestError extends Error {
  constructor(message: string) { super(message); this.name = 'IngestError' }
}

/** True when `entryName` would escape `root` once joined (path-traversal guard). */
export function isUnsafeEntry(entryName: string): boolean {
  if (!entryName || isAbsolute(entryName)) return true
  if (entryName.includes('\0')) return true
  const normalized = normalize(entryName)
  // After normalization, a leading ".." (or being exactly "..") escapes the root.
  return normalized === '..' || normalized.startsWith(`..${sep}`) || normalized.startsWith('../')
}

/**
 * Extract a ZIP buffer into a fresh isolated workspace. Throws IngestError on a
 * malformed archive or a limit/security violation. `mkWorkspace` is injectable
 * for testing.
 */
export async function extractZipToWorkspace(
  buffer: Buffer,
  limits: IngestLimits = DEFAULT_INGEST_LIMITS,
  mkWorkspace: () => string = () => mkdtempSync(join(tmpdir(), 'fp-ingest-')),
): Promise<IngestResult> {
  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(buffer)
  } catch {
    throw new IngestError('Ungültiges oder beschädigtes ZIP-Archiv.')
  }

  const entries = Object.values(zip.files).filter(e => !e.dir)
  if (entries.length === 0) throw new IngestError('ZIP enthält keine Dateien.')
  if (entries.length > limits.maxEntries) {
    throw new IngestError(`Zu viele Dateien im ZIP (${entries.length} > ${limits.maxEntries}).`)
  }

  const workspacePath = mkWorkspace()
  let totalBytes = 0
  let fileCount = 0

  for (const entry of entries) {
    if (isUnsafeEntry(entry.name)) {
      throw new IngestError(`Unsicherer Pfad im ZIP abgelehnt: ${entry.name}`)
    }
    const content = await entry.async('nodebuffer')
    totalBytes += content.byteLength
    if (totalBytes > limits.maxTotalBytes) {
      throw new IngestError(`ZIP zu groß entpackt (> ${Math.round(limits.maxTotalBytes / 1024 / 1024)} MB) — möglicherweise eine Zip-Bombe.`)
    }
    const dest = join(workspacePath, entry.name)
    // Defense in depth: the joined path must still live under the workspace.
    if (dest !== workspacePath && !dest.startsWith(workspacePath + sep)) {
      throw new IngestError(`Unsicherer Pfad im ZIP abgelehnt: ${entry.name}`)
    }
    mkdirSync(dirname(dest), { recursive: true })
    writeFileSync(dest, content)
    fileCount += 1
  }

  return { workspacePath, fileCount, totalBytes }
}
