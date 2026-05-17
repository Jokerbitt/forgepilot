'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'

const DISMISS_KEY = 'forgepilot:banner-dismissed'

export function ApiKeysBanner() {
  const [missing, setMissing] = useState<string[]>([])
  const [dismissed, setDismissed] = useState(true) // start hidden, load async

  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem(DISMISS_KEY)) return
    fetch('/api/api-keys')
      .then(r => r.json())
      .then((data: { _set: Record<string, boolean> }) => {
        const m: string[] = []
        if (!data._set?.ANTHROPIC_API_KEY) m.push('Anthropic API Key')
        if (!data._set?.GITHUB_TOKEN) m.push('GitHub Token')
        if (!data._set?.LINEAR_API_KEY) m.push('Linear API Key')
        setMissing(m)
        setDismissed(false)
      })
      .catch(() => {})
  }, [])

  if (dismissed || missing.length === 0) return null

  return (
    <div className="mx-auto max-w-4xl px-6 pt-4">
      <div className="flex items-start gap-3 rounded-lg border border-yellow-900/50 bg-yellow-950/30 px-4 py-3">
        <span className="mt-0.5 text-yellow-400 flex-shrink-0">⚠</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-yellow-200 font-medium">API Keys fehlen noch</p>
          <p className="text-xs text-yellow-300/70 mt-0.5">
            {missing.join(', ')} — ohne diese sind KI-Features deaktiviert.
            Jetzt eintragen oder später — die App funktioniert auch ohne.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link
            href="/settings"
            className="text-xs font-bold text-yellow-400 hover:text-yellow-300 bg-yellow-900/40 hover:bg-yellow-900/60 border border-yellow-900/50 px-3 py-1.5 rounded-lg transition-colors"
          >
            Eintragen →
          </Link>
          <button
            onClick={() => {
              localStorage.setItem(DISMISS_KEY, '1')
              setDismissed(true)
            }}
            className="text-yellow-600 hover:text-yellow-400 transition-colors text-lg leading-none"
            title="Banner ausblenden"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  )
}
