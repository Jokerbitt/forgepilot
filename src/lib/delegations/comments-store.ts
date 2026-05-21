import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import type { DelegationComment, CommentAuthor } from '@/lib/models/delegation-comment'

const COMMENTS_FILE = path.join(process.cwd(), 'config', 'delegation-comments.json')

function readAll(): DelegationComment[] {
  try {
    return JSON.parse(fs.readFileSync(COMMENTS_FILE, 'utf-8')) as DelegationComment[]
  } catch {
    return []
  }
}

function writeAll(comments: DelegationComment[]): void {
  const dir = path.dirname(COMMENTS_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const tmp = `${COMMENTS_FILE}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(comments, null, 2), 'utf-8')
  fs.renameSync(tmp, COMMENTS_FILE)
}

export function getComments(delegationId: string): DelegationComment[] {
  return readAll()
    .filter(c => c.delegationId === delegationId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export interface AddCommentInput {
  delegationId: string
  author: CommentAuthor
  authorName: string
  body: string
}

export function addComment(input: AddCommentInput): DelegationComment {
  const comment: DelegationComment = {
    id: randomUUID(),
    delegationId: input.delegationId,
    author: input.author,
    authorName: input.authorName,
    body: input.body.trim(),
    createdAt: new Date().toISOString(),
  }
  const all = readAll()
  all.push(comment)
  writeAll(all)
  return comment
}

export function deleteComment(id: string): boolean {
  const all = readAll()
  const filtered = all.filter(c => c.id !== id)
  if (filtered.length === all.length) return false
  writeAll(filtered)
  return true
}
