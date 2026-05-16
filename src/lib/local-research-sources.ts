import fs from 'fs'
import path from 'path'
import type { SourceRecord, SourceType } from '@/lib/models/project-brief'

const TEXT_EXTENSIONS = new Set(['.md', '.txt'])
const IGNORED_DIRS = new Set(['.git', '.next', 'node_modules', 'dist', 'build'])

export interface LocalResearchSourceOptions {
  runId: string
  searchTerms: string[]
  roots?: string[]
  retrievedAt?: string
  maxFiles?: number
  maxSources?: number
  maxFileBytes?: number
}

interface Candidate {
  filePath: string
  score: number
  snippets: string[]
}

export function getDefaultLocalResearchRoots(env: Record<string, string | undefined> = process.env): string[] {
  const configured = env.FORGEPILOT_LOCAL_RESEARCH_PATHS
  if (configured) {
    return configured
      .split(';')
      .map(item => item.trim())
      .filter(Boolean)
  }

  return [
    env.SECOND_BRAIN_PATH,
    env.OBSIDIAN_VAULT_PATH,
    'Z:\\NAS\\SecondBrain',
    'Z:\\NAS\\Codex\\KI Betriebssystem',
  ].filter((item): item is string => Boolean(item))
}

export function collectLocalResearchSources(options: LocalResearchSourceOptions): SourceRecord[] {
  const roots = (options.roots ?? getDefaultLocalResearchRoots()).filter(root => fs.existsSync(root))
  if (roots.length === 0) return []

  const normalizedTerms = normalizeTerms(options.searchTerms)
  if (normalizedTerms.length === 0) return []

  const maxFiles = options.maxFiles ?? 1200
  const maxSources = options.maxSources ?? 5
  const maxFileBytes = options.maxFileBytes ?? 512_000
  const retrievedAt = options.retrievedAt ?? new Date().toISOString()
  const candidates: Candidate[] = []
  let visited = 0

  for (const root of roots) {
    for (const filePath of walkTextFiles(root)) {
      if (visited >= maxFiles) break
      visited += 1

      const stat = safeStat(filePath)
      if (!stat || stat.size > maxFileBytes) continue

      const content = safeRead(filePath)
      if (!content) continue

      const match = scoreContent(content, normalizedTerms)
      if (match.score > 0) {
        candidates.push({ filePath, score: match.score, snippets: match.snippets })
      }
    }
    if (visited >= maxFiles) break
  }

  return candidates
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSources)
    .map((candidate, index) => toSourceRecord(candidate, options.runId, retrievedAt, index))
}

function walkTextFiles(root: string): string[] {
  const files: string[] = []
  const entries = safeReadDir(root)
  for (const entry of entries) {
    const fullPath = path.join(root, entry.name)
    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name)) files.push(...walkTextFiles(fullPath))
      continue
    }
    if (entry.isFile() && TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      files.push(fullPath)
    }
  }
  return files
}

function normalizeTerms(terms: string[]): string[] {
  return Array.from(new Set(
    terms
      .flatMap(term => term.split(/\s+/))
      .map(term => term.toLowerCase().replace(/[^a-z0-9äöüß-]/gi, '').trim())
      .filter(term => term.length >= 4)
  )).slice(0, 12)
}

function scoreContent(content: string, terms: string[]): { score: number; snippets: string[] } {
  const lower = content.toLowerCase()
  const lines = content.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  const snippets: string[] = []
  let score = 0

  for (const term of terms) {
    const index = lower.indexOf(term.toLowerCase())
    if (index >= 0) {
      score += 1
      const line = lines.find(item => item.toLowerCase().includes(term.toLowerCase()))
      if (line && snippets.length < 3) snippets.push(line.slice(0, 280))
    }
  }

  return { score, snippets }
}

function toSourceRecord(candidate: Candidate, runId: string, retrievedAt: string, index: number): SourceRecord {
  const sourceType = inferSourceType(candidate.filePath)
  return {
    id: `${runId}-local-source-${index + 1}`,
    runId,
    type: sourceType,
    title: path.basename(candidate.filePath),
    urlOrPath: candidate.filePath,
    publisher: sourceType === 'obsidian' ? 'Obsidian Vault' : 'Local Filesystem',
    retrievedAt,
    language: 'de',
    relevanceScore: Math.min(100, 50 + candidate.score * 10),
    trustScore: sourceType === 'obsidian' ? 85 : 80,
    notes: 'Lokale Quelle aus NAS/Obsidian Discovery.',
    snippets: candidate.snippets,
  }
}

function inferSourceType(filePath: string): SourceType {
  const lower = filePath.toLowerCase()
  if (lower.includes('secondbrain') || lower.includes('obsidian')) return 'obsidian'
  if (lower.endsWith('.md')) return 'docs'
  return 'nas'
}

function safeReadDir(dirPath: string): fs.Dirent[] {
  try {
    return fs.readdirSync(dirPath, { withFileTypes: true })
  } catch {
    return []
  }
}

function safeRead(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, 'utf-8')
  } catch {
    return null
  }
}

function safeStat(filePath: string): fs.Stats | null {
  try {
    return fs.statSync(filePath)
  } catch {
    return null
  }
}
