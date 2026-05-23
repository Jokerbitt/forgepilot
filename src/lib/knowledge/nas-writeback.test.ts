import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  aiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import * as fs from 'fs'
import { writeKnowledgeCardToNas } from './nas-writeback'
import type { KnowledgeCard } from './knowledge-card'

const card: KnowledgeCard = {
  id: 'abc12345',
  title: 'My Test Lesson',
  content: '## Key Points\n\n- Point one\n- Point two',
  source: 'delegation',
  sourceId: 'del-001',
  tags: ['delegation', 'B', 'claude-api'],
  createdAt: '2026-05-23T10:00:00Z',
  updatedAt: '2026-05-23T10:00:00Z',
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe('writeKnowledgeCardToNas', () => {
  it('returns written: false when SecondBrain is unreachable', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false)
    const result = writeKnowledgeCardToNas(card)
    expect(result.written).toBe(false)
    expect(result.reason).toContain('not reachable')
    expect(fs.writeFileSync).not.toHaveBeenCalled()
  })

  it('writes markdown file when SecondBrain is reachable', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.mkdirSync).mockImplementation(() => undefined)
    vi.mocked(fs.writeFileSync).mockImplementation(() => {})

    const result = writeKnowledgeCardToNas(card)

    expect(result.written).toBe(true)
    expect(result.path).toBeTruthy()
    expect(result.path).toContain('lessons')
    expect(result.path).toContain('abc12345')
    expect(fs.writeFileSync).toHaveBeenCalledOnce()
  })

  it('includes card metadata in frontmatter', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.writeFileSync).mockImplementation(() => {})

    writeKnowledgeCardToNas(card)

    const writtenContent = vi.mocked(fs.writeFileSync).mock.calls[0]?.[1] as string
    expect(writtenContent).toContain('id: abc12345')
    expect(writtenContent).toContain('title: "My Test Lesson"')
    expect(writtenContent).toContain('source: delegation')
    expect(writtenContent).toContain('sourceId: del-001')
  })

  it('includes card body in markdown content', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.writeFileSync).mockImplementation(() => {})

    writeKnowledgeCardToNas(card)

    const writtenContent = vi.mocked(fs.writeFileSync).mock.calls[0]?.[1] as string
    expect(writtenContent).toContain('## Key Points')
    expect(writtenContent).toContain('Point one')
  })

  it('creates lessons dir if it does not exist', () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      // SecondBrain root exists, lessons dir does not
      return !String(p).includes('lessons')
    })
    vi.mocked(fs.mkdirSync).mockImplementation(() => undefined)
    vi.mocked(fs.writeFileSync).mockImplementation(() => {})

    writeKnowledgeCardToNas(card)

    expect(fs.mkdirSync).toHaveBeenCalledOnce()
    expect(vi.mocked(fs.mkdirSync).mock.calls[0]?.[1]).toMatchObject({ recursive: true })
  })

  it('returns written: false and logs warn on fs error', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.writeFileSync).mockImplementation(() => { throw new Error('disk full') })

    const result = writeKnowledgeCardToNas(card)

    expect(result.written).toBe(false)
    expect(result.reason).toContain('disk full')
  })

  it('generates a filename with date prefix and card id', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.writeFileSync).mockImplementation(() => {})

    const result = writeKnowledgeCardToNas(card)

    expect(result.path).toMatch(/\d{4}-\d{2}-\d{2}-abc12345-my-test-lesson\.md$/)
  })
})
