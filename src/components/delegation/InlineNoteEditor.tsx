'use client'

import { useState, useRef, useEffect } from 'react'
import { Pencil, Check, X } from 'lucide-react'

interface Props {
  delegationId: string
  initialText: string | undefined
  onSaved: (text: string | null) => void
}

export function InlineNoteEditor({ delegationId, initialText, onSaved }: Props) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(initialText ?? '')
  const [saving, setSaving] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (editing) textareaRef.current?.focus()
  }, [editing])

  const save = async () => {
    setSaving(true)
    const text = value.trim()
    try {
      await fetch(`/api/delegations/${delegationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          note: text ? { text, updatedAt: new Date().toISOString() } : null,
        }),
      })
      onSaved(text || null)
    } finally {
      setSaving(false)
      setEditing(false)
    }
  }

  const cancel = () => {
    setValue(initialText ?? '')
    setEditing(false)
  }

  if (!editing) {
    return (
      <div className="group flex items-start gap-2">
        <div className="flex-1">
          {value ? (
            <p className="text-sm text-yellow-400/80 leading-relaxed">{value}</p>
          ) : (
            <p className="text-xs text-gray-600 italic">Notiz hinzufügen…</p>
          )}
        </div>
        <button
          onClick={() => setEditing(true)}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-600 hover:text-gray-400 shrink-0 mt-0.5"
          title="Notiz bearbeiten"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { void save() }
          if (e.key === 'Escape') cancel()
        }}
        rows={3}
        maxLength={2000}
        placeholder="Interne Notiz (nur für dich sichtbar)…"
        className="w-full bg-gray-900 border border-yellow-900/50 rounded-lg px-3 py-2 text-sm text-yellow-200/90 placeholder-gray-600 resize-none focus:outline-none focus:border-yellow-700"
      />
      <div className="flex items-center gap-2">
        <button
          onClick={() => void save()}
          disabled={saving}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-yellow-900/40 text-yellow-300 hover:bg-yellow-900/70 border border-yellow-800/60 rounded-lg transition-colors disabled:opacity-40"
        >
          <Check className="w-3 h-3" />
          {saving ? 'Speichern…' : '⌘↵ Speichern'}
        </button>
        <button
          onClick={cancel}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-gray-500 hover:text-gray-300 border border-gray-800 rounded-lg transition-colors"
        >
          <X className="w-3 h-3" />
          Abbrechen
        </button>
        <span className="text-xs text-gray-700 ml-auto">{value.length}/2000</span>
      </div>
    </div>
  )
}
