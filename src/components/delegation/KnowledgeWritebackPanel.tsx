'use client'

import { useEffect, useState } from 'react'
import type { KnowledgeCard } from '@/lib/knowledge/knowledge-card'
import type { Delegation } from '@/lib/models/delegation'

interface KnowledgeWritebackPanelProps {
  delegationId: string
  /** Pass the delegation to enable manual card creation with pre-filled fields. */
  delegation?: Delegation
}

interface KnowledgeCardsResponse {
  cards: KnowledgeCard[]
  total: number
}

function buildDefaultContent(d: Delegation): string {
  const goal = d.contract.goal.slice(0, 200)
  const lastLog = [...(d.logs ?? [])]
    .reverse()
    .find(l => l.type === 'success' || l.type === 'info')
  const outcome = lastLog?.message ?? d.summaryReport?.keyPoints?.join(', ') ?? ''

  if (d.status === 'failed') {
    const errLog = [...(d.logs ?? [])].reverse().find(l => l.type === 'error')
    return `## Was schiefgelaufen ist\n\n${goal}\n\n## Fehler\n\n${errLog?.message ?? outcome ?? 'Unbekannter Fehler'}`
  }
  return `## Was gelernt wurde\n\n${goal}${outcome ? `\n\n## Ergebnis\n\n${outcome}` : ''}`
}

export function KnowledgeWritebackPanel({ delegationId, delegation }: KnowledgeWritebackPanelProps) {
  const [cards, setCards]         = useState<KnowledgeCard[]>([])
  const [loading, setLoading]     = useState(true)
  const [creating, setCreating]   = useState(false)
  const [saving, setSaving]       = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const defaultTitle   = delegation?.title ?? delegation?.contract.goal.slice(0, 80) ?? ''
  const defaultContent = delegation ? buildDefaultContent(delegation) : ''
  const defaultTags    = [...(delegation?.tags ?? []), delegation?.executionRoute].filter(Boolean) as string[]

  const [title,   setTitle]   = useState(defaultTitle)
  const [content, setContent] = useState(defaultContent)
  const [tagsRaw, setTagsRaw] = useState(defaultTags.join(', '))

  function reload() {
    fetch(`/api/knowledge-cards?sourceId=${encodeURIComponent(delegationId)}`)
      .then(r => r.json())
      .then((data: KnowledgeCardsResponse) => setCards(data.cards ?? []))
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }

  useEffect(() => { reload() }, [delegationId])  // eslint-disable-line react-hooks/exhaustive-deps

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      await fetch(`/api/knowledge-cards/${encodeURIComponent(id)}`, { method: 'DELETE' })
      setCards(prev => prev.filter(c => c.id !== id))
    } catch {
      // non-critical — card stays in list
    } finally {
      setDeletingId(null)
    }
  }

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    const tags = tagsRaw.split(',').map(t => t.trim()).filter(Boolean)
    try {
      const res = await fetch('/api/knowledge-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:    title.trim(),
          content:  content.trim(),
          sourceId: delegationId,
          briefId:  delegation?.briefId,
          prUrl:    delegation?.summaryReport?.prUrl,
          tags,
        }),
      })
      if (!res.ok) {
        const err = await res.json() as { error?: string }
        setSaveError(err.error ?? `HTTP ${res.status}`)
        return
      }
      setCreating(false)
      setLoading(true)
      reload()
    } catch (e) {
      setSaveError(String(e))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-gray-600" />
          Knowledge Writeback
        </h2>
        <div className="h-4 bg-gray-800 rounded animate-pulse w-48" />
      </div>
    )
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
        <span className={`h-1.5 w-1.5 rounded-full ${cards.length > 0 ? 'bg-emerald-500' : 'bg-gray-600'}`} />
        Knowledge Writeback
        {cards.length > 0 && (
          <span className="ml-auto text-[10px] text-emerald-600 font-mono">
            {cards.length} Lektion{cards.length !== 1 ? 'en' : ''}
          </span>
        )}
        {!creating && delegation && (
          <button
            onClick={() => {
              setTitle(defaultTitle)
              setContent(defaultContent)
              setTagsRaw(defaultTags.join(', '))
              setSaveError(null)
              setCreating(true)
            }}
            className="ml-auto text-[10px] text-emerald-700 hover:text-emerald-500 transition-colors underline underline-offset-2"
          >
            + Lektion erstellen
          </button>
        )}
      </h2>

      {/* Inline create form */}
      {creating && (
        <div className="mb-4 space-y-2 border border-emerald-900/40 rounded-lg p-3 bg-emerald-950/10">
          <div>
            <label className="text-[10px] text-gray-500 uppercase tracking-wider">Titel</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              maxLength={200}
              className="mt-1 w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-emerald-700"
            />
          </div>
          <div>
            <label className="text-[10px] text-gray-500 uppercase tracking-wider">Inhalt (Markdown)</label>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={6}
              maxLength={10_000}
              className="mt-1 w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 font-mono focus:outline-none focus:border-emerald-700 resize-y"
            />
          </div>
          <div>
            <label className="text-[10px] text-gray-500 uppercase tracking-wider">Tags (kommagetrennt)</label>
            <input
              type="text"
              value={tagsRaw}
              onChange={e => setTagsRaw(e.target.value)}
              placeholder="z.B. api-route, typescript"
              className="mt-1 w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-emerald-700"
            />
          </div>
          {saveError && <p className="text-[10px] text-red-400">{saveError}</p>}
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => void handleSave()}
              disabled={saving || !title.trim() || !content.trim()}
              className="px-3 py-1 text-xs rounded bg-emerald-700 text-white hover:bg-emerald-600 disabled:opacity-40 transition-colors"
            >
              {saving ? 'Speichern…' : 'Speichern'}
            </button>
            <button
              onClick={() => { setCreating(false); setSaveError(null) }}
              className="px-3 py-1 text-xs rounded bg-gray-800 text-gray-400 hover:text-gray-200 transition-colors"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {cards.length === 0 && !creating ? (
        <p className="text-xs text-gray-600 italic">Noch kein Writeback — Lektionen werden nach Abschluss gespeichert.</p>
      ) : (
        <ul className="space-y-2">
          {cards.map(card => (
            <li key={card.id} className="flex flex-col gap-0.5 group">
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-medium text-emerald-400 flex-1">{card.title}</span>
                {delegation && (
                  <button
                    onClick={() => void handleDelete(card.id)}
                    disabled={deletingId === card.id}
                    aria-label="Lektion löschen"
                    className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-[10px] text-gray-600 hover:text-red-400 disabled:opacity-40"
                  >
                    {deletingId === card.id ? '…' : '✕'}
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-400 leading-relaxed line-clamp-3">{card.content}</p>
              {card.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {card.tags.map(tag => (
                    <span key={tag} className="px-1.5 py-0 text-[10px] rounded bg-gray-800 border border-gray-700 text-gray-500 font-mono">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
