'use client'

import { useEffect, useRef, useState } from 'react'
import type { DelegationComment, CommentAuthor } from '@/lib/models/delegation-comment'

const AUTHOR_STYLES: Record<CommentAuthor, string> = {
  user: 'bg-violet-500/10 border-violet-500/20 text-violet-200',
  agent: 'bg-sky-500/10 border-sky-500/20 text-sky-200',
  system: 'bg-slate-700/40 border-slate-600/20 text-slate-400',
}

const AUTHOR_BADGE: Record<CommentAuthor, string> = {
  user: 'bg-violet-600/30 text-violet-300',
  agent: 'bg-sky-600/30 text-sky-300',
  system: 'bg-slate-600/40 text-slate-400',
}

function formatTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('de-DE', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

interface CommentBubbleProps {
  comment: DelegationComment
}

function CommentBubble({ comment }: CommentBubbleProps) {
  return (
    <div className={`rounded-lg border px-3 py-2 text-sm ${AUTHOR_STYLES[comment.author]}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${AUTHOR_BADGE[comment.author]}`}>
          {comment.authorName}
        </span>
        <span className="text-xs text-slate-500">{formatTime(comment.createdAt)}</span>
      </div>
      <p className="whitespace-pre-wrap leading-relaxed">{comment.body}</p>
    </div>
  )
}

interface DelegationCommentThreadProps {
  delegationId: string
}

export function DelegationCommentThread({ delegationId }: DelegationCommentThreadProps) {
  const [comments, setComments] = useState<DelegationComment[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    void fetch(`/api/delegations/${delegationId}/comments`)
      .then(res => res.json())
      .then((data: { comments: DelegationComment[] }) => setComments(data.comments))
      .catch(() => null)
  }, [delegationId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [comments.length])

  const handleSend = async () => {
    const body = draft.trim()
    if (!body || sending) return
    setSending(true)
    setError(null)
    try {
      const res = await fetch(`/api/delegations/${delegationId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body, author: 'user', authorName: 'Sven' }),
      })
      if (!res.ok) {
        setError('Kommentar konnte nicht gespeichert werden.')
        return
      }
      const data = await res.json() as { comment: DelegationComment }
      setComments(prev => [...prev, data.comment])
      setDraft('')
    } catch {
      setError('Netzwerkfehler — bitte erneut versuchen.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
        Kommentare ({comments.length})
      </h2>

      {/* Thread list */}
      {comments.length === 0 ? (
        <p className="text-xs text-slate-600 italic">Noch keine Kommentare — füge den ersten hinzu.</p>
      ) : (
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {comments.map(c => (
            <CommentBubble key={c.id} comment={c} />
          ))}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2 pt-1">
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void handleSend()
          }}
          placeholder="Kommentar schreiben… (⌘↵ zum Senden)"
          rows={2}
          className="flex-1 resize-none rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/20"
        />
        <button
          onClick={() => void handleSend()}
          disabled={!draft.trim() || sending}
          className="self-end rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-500 disabled:opacity-40"
        >
          {sending ? '…' : 'Senden'}
        </button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}
