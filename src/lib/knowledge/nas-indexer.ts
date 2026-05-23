import { readFileSync, readdirSync, existsSync, statSync } from 'fs'
import { join, basename } from 'path'
import { createHash } from 'crypto'
import { randomUUID } from 'crypto'
import { upsertSource, upsertItem, upsertCard, getSources, getItems } from './store'
import type { KnowledgeSource, KnowledgeItem, MemoryCard, MemoryCardType, PrivacyClass } from './types'

export interface IndexResult {
  sourcesIndexed: number
  itemsIndexed: number
  cardsCreated: number
  skipped: number
  sensitiveSkipped: number
  errors: string[]
}

// Use FORGEPILOT_DOCS_DIR env var for portability (any drive, any OS)
// Falls back to the legacy NAS path for backward compatibility
const NAS_ROOT = process.env.FORGEPILOT_DOCS_DIR ?? '/Volumes/Sven/NAS/Codex/KI Betriebssystem'

const NAS_SUBDIRS = ['Standards', 'ADRs', 'Agent_Skills', 'Screen_Specs']

// SecondBrain root — configurable via env var
// Falls back to standard NAS SecondBrain location
const SECONDBRAIN_ROOT = process.env.FORGEPILOT_SECONDBRAIN_DIR ?? '/Volumes/Sven/NAS/SecondBrain'

// Subdirs within SecondBrain to index recursively
const SECONDBRAIN_SUBDIRS = ['02_Knowledge', join('01_Projects', 'forgepilot')]

const SENSITIVE_FILE_PATTERNS = [
  'credential',
  'credentials',
  'secret',
  'secrets',
  'api-key',
  'api_keys',
  'settings-credentials',
  'forgerpilot-settings-credentials',
  'forgepilot-settings-credentials',
]

// Classify the memory card type from section heading and content
function inferCardType(heading: string, body: string): MemoryCardType {
  const h = heading.toLowerCase()
  const b = body.toLowerCase()
  if (h.includes('entscheidung') || h.includes('adr') || h.includes('decision') || b.includes('wir entscheiden')) return 'decision'
  if (h.includes('risiko') || h.includes('risk') || b.includes('risiko')) return 'risk'
  if (h.includes('anforderung') || h.includes('requirement') || h.includes('akzeptanzkriterien')) return 'requirement'
  if (h.includes('muster') || h.includes('pattern') || h.includes('standard')) return 'pattern'
  if (h.includes('lern') || h.includes('ergebnis') || h.includes('lesson') || h.includes('result')) return 'learning'
  return 'context'
}

function privacyFromPath(filePath: string): PrivacyClass {
  const name = basename(filePath).toLowerCase()
  if (name.includes('credentials') || name.includes('secret') || name.includes('settings')) return 'sensitive'
  return 'internal'
}

function shouldSkipSensitiveFile(filePath: string): boolean {
  const name = basename(filePath).toLowerCase()
  return SENSITIVE_FILE_PATTERNS.some(pattern => name.includes(pattern))
}

function contentHash(content: string): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 16)
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

// Extract H2 sections from markdown content
function extractSections(content: string): Array<{ heading: string; body: string }> {
  const lines = content.split('\n')
  const sections: Array<{ heading: string; body: string }> = []
  let currentHeading = ''
  let currentLines: string[] = []

  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (currentHeading) {
        sections.push({ heading: currentHeading, body: currentLines.join('\n').trim() })
      }
      currentHeading = line.replace(/^##\s+/, '').trim()
      currentLines = []
    } else {
      currentLines.push(line)
    }
  }
  if (currentHeading) {
    sections.push({ heading: currentHeading, body: currentLines.join('\n').trim() })
  }
  return sections
}

function collectMarkdownFiles(dir: string, recursive = false): string[] {
  if (!existsSync(dir)) return []
  const files: string[] = []
  try {
    const entries = readdirSync(dir)
    for (const entry of entries) {
      if (entry.startsWith('.')) continue
      const fullPath = join(dir, entry)
      const stat = statSync(fullPath)
      if (stat.isFile() && entry.endsWith('.md')) {
        files.push(fullPath)
      } else if (recursive && stat.isDirectory()) {
        files.push(...collectMarkdownFiles(fullPath, true))
      }
    }
  } catch {
    // ignore unreadable dirs
  }
  return files
}

export async function indexNasFiles(): Promise<IndexResult> {
  const result: IndexResult = { sourcesIndexed: 0, itemsIndexed: 0, cardsCreated: 0, skipped: 0, sensitiveSkipped: 0, errors: [] }

  const nasReachable = existsSync(NAS_ROOT)
  const secondbrainReachable = existsSync(SECONDBRAIN_ROOT)

  if (!nasReachable && !secondbrainReachable) {
    result.errors.push(`Keine Wissensquelle erreichbar: ${NAS_ROOT}, ${SECONDBRAIN_ROOT}`)
    return result
  }

  // Collect all .md files from NAS Codex root + subdirs
  const files: string[] = []
  if (nasReachable) {
    files.push(...collectMarkdownFiles(NAS_ROOT))
    for (const sub of NAS_SUBDIRS) {
      files.push(...collectMarkdownFiles(join(NAS_ROOT, sub)))
    }
  }

  // Collect SecondBrain files recursively from each configured subdir
  if (secondbrainReachable) {
    for (const sub of SECONDBRAIN_SUBDIRS) {
      files.push(...collectMarkdownFiles(join(SECONDBRAIN_ROOT, sub), true))
    }
  }

  const existingSources = getSources()
  const sourceByPath = new Map(existingSources.map(s => [s.path, s]))

  const now = new Date().toISOString()

  for (const filePath of files) {
    if (shouldSkipSensitiveFile(filePath)) {
      result.sensitiveSkipped++
      continue
    }

    let content: string
    try {
      content = readFileSync(filePath, 'utf-8')
    } catch (e) {
      result.errors.push(`Lesen fehlgeschlagen: ${filePath}`)
      continue
    }

    const hash = contentHash(content)
    const existing = sourceByPath.get(filePath)

    // Skip if unchanged
    if (existing && existing.hash === hash) {
      result.skipped++
      continue
    }

    const sourceId = existing?.id ?? randomUUID()
    const fileName = basename(filePath, '.md')
    const privacyClass = privacyFromPath(filePath)
    const tagSource: 'nas' | 'secondbrain' = filePath.startsWith(SECONDBRAIN_ROOT) ? 'secondbrain' : 'nas'

    const source: KnowledgeSource = {
      id: sourceId,
      type: 'nas',
      name: fileName,
      path: filePath,
      hash,
      privacyClass,
      lastFetched: now,
      freshnessTtlHours: 168, // 1 week
      isStale: false,
      metadata: { indexedFrom: tagSource === 'secondbrain' ? 'secondbrain-indexer' : 'nas-indexer' },
    }
    upsertSource(source)
    result.sourcesIndexed++

    // Remove old items for this source before re-inserting
    const oldItems = getItems(sourceId)
    const oldItemIds = new Set(oldItems.map(i => i.id))
    void oldItemIds // tracked for future incremental cleanup

    // Create one KnowledgeItem for the whole file
    const title = fileName.replace(/^\d+_/, '').replace(/-/g, ' ')
    const itemId = `item-${sourceId}`
    const item: KnowledgeItem = {
      id: itemId,
      sourceId,
      title,
      content: content.slice(0, 2000), // store a preview
      summary: content.split('\n').find(l => l.trim().length > 20 && !l.startsWith('#')) ?? title,
      tags: inferTags(fileName, content, tagSource),
      privacyClass,
      confidence: 'high',
      tokenEstimate: estimateTokens(content),
      createdAt: now,
      updatedAt: now,
    }
    upsertItem(item)
    result.itemsIndexed++

    // Create MemoryCards for H2 sections (max 5 per file to keep store lean)
    const sections = extractSections(content).slice(0, 5)
    for (const section of sections) {
      if (section.body.length < 30) continue
      const cardId = `card-${sourceId}-${contentHash(section.heading)}`
      const card: MemoryCard = {
        id: cardId,
        type: inferCardType(section.heading, section.body),
        title: `${title}: ${section.heading}`,
        body: section.body.slice(0, 500),
        sourceIds: [itemId],
        tags: inferTags(fileName, section.body, tagSource),
        privacyClass,
        confidence: 'high',
        createdAt: now,
        updatedAt: now,
      }
      upsertCard(card)
      result.cardsCreated++
    }

    // If file has no H2 sections, create one card from the file intro
    if (sections.length === 0) {
      const intro = content.replace(/^#[^\n]*\n/, '').trim().slice(0, 400)
      if (intro.length > 30) {
        const cardId = `card-${sourceId}-intro`
        const card: MemoryCard = {
          id: cardId,
          type: 'context',
          title,
          body: intro,
          sourceIds: [itemId],
          tags: inferTags(fileName, content, tagSource),
          privacyClass,
          confidence: 'high',
          createdAt: now,
          updatedAt: now,
        }
        upsertCard(card)
        result.cardsCreated++
      }
    }
  }

  return result
}

export interface IndexStatus {
  sourcesTotal: number
  staleSources: number
  lastIndexedAt: string | null
  nasReachable: boolean
  secondbrainReachable: boolean
}

export function getIndexStatus(): IndexStatus {
  const sources = getSources()
  const now = Date.now()
  let staleSources = 0
  let lastIndexedAt: string | null = null

  for (const source of sources) {
    const fetchedMs = new Date(source.lastFetched).getTime()
    const ttlMs = (source.freshnessTtlHours ?? 168) * 60 * 60 * 1000
    if (now - fetchedMs > ttlMs) staleSources++
    if (!lastIndexedAt || source.lastFetched > lastIndexedAt) {
      lastIndexedAt = source.lastFetched
    }
  }

  return {
    sourcesTotal: sources.length,
    staleSources,
    lastIndexedAt,
    nasReachable: existsSync(NAS_ROOT),
    secondbrainReachable: existsSync(SECONDBRAIN_ROOT),
  }
}

function inferTags(fileName: string, content: string, source: 'nas' | 'secondbrain' = 'nas'): string[] {
  const tags: string[] = [source]
  const name = fileName.toLowerCase()
  if (name.includes('adr')) tags.push('adr', 'decision')
  if (name.includes('skill')) tags.push('skill', 'agent')
  if (name.includes('roadmap') || name.includes('milestone')) tags.push('roadmap')
  if (name.includes('architektur') || name.includes('blueprint')) tags.push('architecture')
  if (name.includes('requirements') || name.includes('backlog')) tags.push('requirements')
  if (name.includes('knowledge') || name.includes('memory')) tags.push('knowledge')
  if (name.includes('collaboration') || name.includes('protocol')) tags.push('protocol', 'agent')
  if (name.includes('escalation')) tags.push('escalation', 'agent')
  if (name.includes('model') || name.includes('routing')) tags.push('model-routing', 'ai')
  if (name.includes('standard')) tags.push('standard')
  if (name.includes('fehler') || name.includes('problem') || name.includes('loesung')) tags.push('troubleshooting')
  if (name.includes('setup') || name.includes('einrichten')) tags.push('setup')
  if (name.includes('pattern')) tags.push('pattern')
  if (name.includes('workflow')) tags.push('workflow')
  const c = content.toLowerCase()
  if (c.includes('ollama') || c.includes('local ai') || c.includes('lokal')) tags.push('local-ai')
  if (c.includes('privacy') || c.includes('datenschutz')) tags.push('privacy')
  if (c.includes('docker') || c.includes('container')) tags.push('docker')
  return Array.from(new Set(tags))
}
