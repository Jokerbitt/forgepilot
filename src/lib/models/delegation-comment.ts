export type CommentAuthor = 'user' | 'agent' | 'system'

export interface DelegationComment {
  id: string
  delegationId: string
  author: CommentAuthor
  /** Display name — e.g. "Sven", "Claude Sonnet 4.5", "ForgePilot" */
  authorName: string
  body: string
  createdAt: string
}
