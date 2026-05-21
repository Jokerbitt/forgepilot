'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  briefId: string
  briefTitle: string
}

export function StartDelegationButton({ briefId, briefTitle }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleClick() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/project-briefs/${briefId}/suggest-delegation`)
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        setError(data.error ?? 'Fehler beim Laden des Delegation-Vorschlags')
        return
      }
      router.push(`/delegations?briefId=${briefId}&new=1`)
    } catch {
      setError('Netzwerkfehler — bitte erneut versuchen')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={loading}
        aria-label={`Delegation starten fuer ${briefTitle}`}
        className="inline-flex items-center gap-2 rounded-md bg-gradient-to-r from-violet-600 to-violet-500 px-4 py-2 text-sm font-medium text-white transition-all hover:from-violet-500 hover:to-violet-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? (
          <>
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            Laden
          </>
        ) : (
          <>
            <span aria-hidden="true">&#x2192;</span>
            Delegation starten
          </>
        )}
      </button>
      {error && (
        <p className="mt-1.5 text-xs text-rose-400">{error}</p>
      )}
    </div>
  )
}
