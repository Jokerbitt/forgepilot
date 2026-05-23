import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { KnowledgeCard } from './knowledge-card'
import { aiLogger } from '@/lib/logger'

const SECONDBRAIN_ROOT =
  process.env.FORGEPILOT_SECONDBRAIN_DIR ?? '/Volumes/Sven/NAS/SecondBrain'

const LESSONS_DIR = join(SECONDBRAIN_ROOT, '01_Projects', 'forgepilot', 'lessons')

export interface NasWritebackResult {
  written: boolean
  path?: string
  reason?: string
}

/**
 * M306: Writes a KnowledgeCard to the SecondBrain as a Markdown file.
 * Creates the lessons dir if it doesn't exist.
 * Fail-safe: if SecondBrain is unreachable, returns { written: false }.
 */
export function writeKnowledgeCardToNas(card: KnowledgeCard): NasWritebackResult {
  try {
    if (!existsSync(SECONDBRAIN_ROOT)) {
      return { written: false, reason: 'SecondBrain not reachable' }
    }

    if (!existsSync(LESSONS_DIR)) {
      mkdirSync(LESSONS_DIR, { recursive: true })
    }

    const datePrefix = new Date().toISOString().slice(0, 10)
    const shortId = card.id.slice(0, 8)
    const slug = card.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50)
    const fileName = `${datePrefix}-${shortId}-${slug}.md`
    const filePath = join(LESSONS_DIR, fileName)

    const tagsLine = card.tags.length > 0 ? `tags: [${card.tags.map(t => `"${t}"`).join(', ')}]\n` : ''
    const markdown = [
      '---',
      `id: ${card.id}`,
      `title: "${card.title}"`,
      `source: ${card.source}`,
      `sourceId: ${card.sourceId}`,
      tagsLine.trim(),
      `createdAt: ${card.createdAt}`,
      '---',
      '',
      `# ${card.title}`,
      '',
      card.content,
    ].filter(line => line !== undefined).join('\n')

    writeFileSync(filePath, markdown, 'utf-8')

    aiLogger.info(
      { event: 'nas.writeback', cardId: card.id, path: filePath },
      'KnowledgeCard written to SecondBrain',
    )

    return { written: true, path: filePath }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    aiLogger.warn(
      { event: 'nas.writeback.error', cardId: card.id, reason },
      'NAS writeback failed — non-critical',
    )
    return { written: false, reason }
  }
}
