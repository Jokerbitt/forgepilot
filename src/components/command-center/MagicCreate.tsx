'use client'

import { useState, useRef, useEffect } from 'react'

const SUGGESTIONS = [
  "✨ Neues Feature: ",
  "🐛 Bugfix: ",
  "♻️ Refactoring: ",
  "📝 Dokumentation: "
]

export function MagicCreate() {
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!prompt.trim() || loading) return

    setLoading(true)
    try {
      await fetch('/api/magic-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      })
      
      setPrompt('')
      setShowSuggestions(false)
      window.location.reload()
    } catch (error) {
      console.error('Failed to create ticket', error)
      setLoading(false)
    }
  }

  const selectSuggestion = (suggestion: string) => {
    setPrompt(suggestion)
    setShowSuggestions(false)
  }

  return (
    <div ref={wrapperRef} className="mb-6 relative">
      <form onSubmit={handleCreate} className="relative flex items-center">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <span className="text-gray-500">✨</span>
        </div>
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onFocus={() => setShowSuggestions(true)}
          disabled={loading}
          placeholder="Magic Create: Beschreibe eine Idee oder Aufgabe und drücke Enter..."
          className="block w-full pl-10 pr-12 py-4 border border-gray-800 rounded-xl leading-5 bg-gray-900 text-gray-300 placeholder-gray-500 focus:outline-none focus:bg-gray-950 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors shadow-lg"
        />
        
        {/* Info Tooltip */}
        <div className="absolute inset-y-0 right-10 flex items-center group cursor-help">
          <span className="text-gray-500 hover:text-blue-400 text-lg transition-colors">ℹ️</span>
          <div className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-gray-800 text-xs text-gray-300 rounded shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
            <strong>Wie funktioniert Magic Create?</strong><br/>
            Tippe eine kurze Idee ein. ForgePilot erstellt daraus lokal ein priorisiertes Ticket. In der Karte kannst du später per "Magic Refine" daraus eine professionelle User Story generieren lassen.
          </div>
        </div>

        {loading && (
          <div className="absolute inset-y-0 right-3 flex items-center">
            <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
          </div>
        )}
      </form>

      {/* Suggestions Dropdown */}
      {showSuggestions && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-40 overflow-hidden">
          <div className="p-2 text-xs font-bold text-gray-500 uppercase tracking-wider bg-gray-950 border-b border-gray-800">
            Vorschläge
          </div>
          <ul>
            {SUGGESTIONS.map(s => (
              <li 
                key={s}
                onClick={() => selectSuggestion(s)}
                className="px-4 py-3 hover:bg-gray-800 cursor-pointer text-sm text-gray-300 transition-colors border-b border-gray-800/50 last:border-0"
              >
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
