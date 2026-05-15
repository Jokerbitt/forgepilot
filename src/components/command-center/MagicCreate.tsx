'use client'

import { useState } from 'react'

export function MagicCreate() {
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)

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
      // Force reload to show new ticket
      window.location.reload()
    } catch (error) {
      console.error('Failed to create ticket', error)
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleCreate} className="mb-6 relative">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <span className="text-gray-500">✨</span>
      </div>
      <input
        type="text"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        disabled={loading}
        placeholder="Magic Create: Beschreibe eine Idee oder Aufgabe und drücke Enter..."
        className="block w-full pl-10 pr-3 py-4 border border-gray-800 rounded-xl leading-5 bg-gray-900 text-gray-300 placeholder-gray-500 focus:outline-none focus:bg-gray-950 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors shadow-lg"
      />
      {loading && (
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
          <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
        </div>
      )}
    </form>
  )
}
