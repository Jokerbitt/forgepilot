import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DelegationComment } from '@/lib/models/delegation-comment'

const files = vi.hoisted(() => ({} as Record<string, string>))

vi.mock('fs', () => {
  const fsMock = {
    existsSync: (p: string) => p in files,
    readFileSync: (p: string) => {
      if (p in files) return files[p]
      throw Object.assign(new Error(`ENOENT: ${p}`), { code: 'ENOENT' })
    },
    writeFileSync: (p: string, data: string) => { files[p] = data },
    renameSync: (from: string, to: string) => {
      files[to] = files[from]
      delete files[from]
    },
    mkdirSync: vi.fn(),
  }
  return { default: fsMock, ...fsMock }
})

const COMMENTS_KEY = `${process.cwd()}/config/delegation-comments.json`

function clearFiles() {
  Object.keys(files).forEach(key => delete files[key])
}

function seed(comments: DelegationComment[]) {
  files[COMMENTS_KEY] = JSON.stringify(comments)
}

function makeComment(overrides: Partial<DelegationComment> = {}): DelegationComment {
  return {
    id: 'c-1',
    delegationId: 'del-1',
    author: 'user',
    authorName: 'Sven',
    body: 'Looks good',
    createdAt: '2026-01-01T10:00:00.000Z',
    ...overrides,
  }
}

describe('delegation comments store', () => {
  beforeEach(() => {
    clearFiles()
    vi.resetModules()
  })

  it('returns empty comments when the store file is missing', async () => {
    const { getComments } = await import('./comments-store')
    expect(getComments('del-1')).toEqual([])
  })

  it('returns only comments for the requested delegation sorted by time', async () => {
    seed([
      makeComment({ id: 'late', createdAt: '2026-01-01T12:00:00.000Z' }),
      makeComment({ id: 'other', delegationId: 'del-2' }),
      makeComment({ id: 'early', createdAt: '2026-01-01T08:00:00.000Z' }),
    ])

    const { getComments } = await import('./comments-store')
    const result = getComments('del-1')

    expect(result.map(comment => comment.id)).toEqual(['early', 'late'])
  })

  it('trims and persists new comments', async () => {
    const { addComment, getComments } = await import('./comments-store')

    const created = addComment({
      delegationId: 'del-1',
      author: 'agent',
      authorName: 'Codex',
      body: '  Finished validation.  ',
    })

    expect(created.body).toBe('Finished validation.')
    expect(getComments('del-1')).toHaveLength(1)
    expect(JSON.parse(files[COMMENTS_KEY]) as DelegationComment[]).toHaveLength(1)
  })

  it('deletes an existing comment by id', async () => {
    seed([makeComment({ id: 'keep' }), makeComment({ id: 'delete-me' })])

    const { deleteComment, getComments } = await import('./comments-store')

    expect(deleteComment('delete-me')).toBe(true)
    expect(getComments('del-1').map(comment => comment.id)).toEqual(['keep'])
  })

  it('returns false when deleting an unknown comment', async () => {
    seed([makeComment({ id: 'keep' })])

    const { deleteComment } = await import('./comments-store')

    expect(deleteComment('missing')).toBe(false)
  })
})
