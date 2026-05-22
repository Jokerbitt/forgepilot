'use client'

import { useState, useRef, KeyboardEvent } from 'react'
import { X, Plus } from 'lucide-react'

interface Props {
  delegationId: string
  initialTags: string[]
  onSaved: (tags: string[]) => void
}

export function DelegationTagEditor({ delegationId, initialTags, onSaved }: Props) {
  const [tags, setTags] = useState<string[]>(initialTags)
  const [input, setInput] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const persist = async (nextTags: string[]) => {
    setSaving(true)
    try {
      await fetch(`/api/delegations/${delegationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: nextTags }),
      })
      onSaved(nextTags)
    } finally {
      setSaving(false)
    }
  }

  const addTag = async () => {
    const tag = input.trim().toLowerCase().replace(/\s+/g, '-').slice(0, 32)
    if (!tag || tags.includes(tag) || tags.length >= 10) return
    const next = [...tags, tag]
    setTags(next)
    setInput('')
    await persist(next)
  }

  const removeTag = async (tag: string) => {
    const next = tags.filter(t => t !== tag)
    setTags(next)
    await persist(next)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      void addTag()
    }
    if (e.key === 'Backspace' && !input && tags.length > 0) {
      void removeTag(tags[tags.length - 1]!)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 min-h-[28px]">
      {tags.map(tag => (
        <span
          key={tag}
          className="flex items-center gap-1 px-2 py-0.5 bg-indigo-900/40 text-indigo-300 border border-indigo-800/60 rounded-full text-xs"
        >
          {tag}
          <button
            onClick={() => void removeTag(tag)}
            disabled={saving}
            className="text-indigo-500 hover:text-indigo-200 transition-colors disabled:opacity-40"
            aria-label={`Tag ${tag} entfernen`}
          >
            <X className="w-2.5 h-2.5" />
          </button>
        </span>
      ))}
      {tags.length < 10 && (
        <div className="flex items-center gap-1">
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            onBlur={() => { if (input.trim()) void addTag() }}
            placeholder={tags.length === 0 ? 'Tag hinzufügen…' : '+'}
            maxLength={32}
            className="bg-transparent text-xs text-gray-400 placeholder-gray-700 outline-none w-24 focus:w-32 transition-all"
          />
          {input.trim() && (
            <button
              onClick={() => void addTag()}
              disabled={saving}
              className="text-gray-600 hover:text-indigo-400 transition-colors disabled:opacity-40"
            >
              <Plus className="w-3 h-3" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
