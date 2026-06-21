/**
 * Reverse-Engineering — documentation ingest (read-only).
 *
 * Reads an existing app's docs (README, ARCHITECTURE, docs/) and extracts
 * plain-language feature/domain hints. The code scan sees STRUCTURE; the docs
 * often reveal INTENT — what the app is for and which features exist. These
 * hints enrich the analysis report and the rebuild plan. Pure-ish: reads files
 * read-only, never writes.
 */
import fs from 'fs'
import path from 'path'

export interface DocHints {
  /** Doc files that were read (relative paths). */
  sources: string[]
  /** Project tagline — first meaningful description line, if any. */
  tagline?: string
  /** Plain-language feature/section hints pulled from headings + bullets. */
  hints: string[]
}

const DOC_CANDIDATES = [
  'README.md', 'README', 'readme.md', 'Readme.md',
  'docs/README.md', 'ARCHITECTURE.md', 'docs/ARCHITECTURE.md',
  'REQUIREMENTS.md', 'SPEC.md', 'docs/SPEC.md', 'FEATURES.md',
]
const MAX_FILES = 4
const MAX_CHARS = 20_000
const MAX_HINTS = 12

/** First non-heading, non-badge line — usually the project's one-line pitch. */
function firstParagraph(text: string): string | undefined {
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#') || line.startsWith('![') || line.startsWith('[!') || line.startsWith('<')) continue
    if (line.length < 10) continue
    return line.replace(/[`*_]/g, '').slice(0, 200)
  }
  return undefined
}

/** Pull section headings (## …) and feature bullets as plain-language hints. */
function extractHints(text: string): string[] {
  const hints: string[] = []
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    const heading = line.match(/^#{2,4}\s+(.{3,60})$/)
    if (heading) { hints.push(heading[1].replace(/[`*_#]/g, '').trim()); continue }
    const bullet = line.match(/^[-*]\s+(.{4,80})$/)
    if (bullet) {
      const item = bullet[1].replace(/[`*_[\]]/g, '').trim()
      if (!/^https?:/i.test(item)) hints.push(item)
    }
  }
  const seen = new Set<string>()
  const unique: string[] = []
  for (const h of hints) {
    const key = h.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(h)
    if (unique.length >= MAX_HINTS) break
  }
  return unique
}

/** Read an app's docs and extract plain-language hints (read-only). */
export function ingestDocs(repoPath: string): DocHints {
  const sources: string[] = []
  let combined = ''
  for (const rel of DOC_CANDIDATES) {
    if (sources.length >= MAX_FILES) break
    const full = path.join(repoPath, rel)
    try {
      if (!fs.existsSync(full) || !fs.statSync(full).isFile()) continue
      sources.push(rel)
      combined += `\n${fs.readFileSync(full, 'utf-8')}`
      if (combined.length >= MAX_CHARS) { combined = combined.slice(0, MAX_CHARS); break }
    } catch {
      /* unreadable — skip */
    }
  }
  if (sources.length === 0) return { sources: [], hints: [] }
  return { sources, tagline: firstParagraph(combined), hints: extractHints(combined) }
}
