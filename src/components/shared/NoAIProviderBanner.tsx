'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import type { AIStatus } from '@/app/api/ai/status/route'

const DISMISS_KEY = 'forgepilot:no-ai-banner-dismissed'

export function NoAIProviderBanner() {
  const [activeProvider, setActiveProvider] = useState<AIStatus['activeProvider'] | null>(null)
  const [dismissed, setDismissed] = useState(true) // start hidden until loaded

  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem(DISMISS_KEY)) return
    fetch('/api/ai/status')
      .then(r => r.json())
      .then((data: AIStatus) => {
        setActiveProvider(data.activeProvider)
        setDismissed(false)
      })
      .catch(() => {})
  }, [])

  if (dismissed || activeProvider !== 'none') return null

  return (
    <div className="mx-auto max-w-4xl px-6 pt-4">
      <div className="flex items-start gap-3 rounded-lg border border-yellow-900/50 bg-yellow-950/30 px-4 py-3">
        <span className="mt-0.5 text-yellow-400 shrink-0">⚠</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-yellow-200 font-medium">
            Kein KI-Anbieter aktiv — KI-Features sind deaktiviert.
          </p>
          <p className="text-xs text-yellow-300/70 mt-0.5">
            Starte Ollama (kostenlos, lokal) oder konfiguriere einen API Key in den Einstellungen.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/settings"
            className="text-xs font-bold text-yellow-400 hover:text-yellow-300 bg-yellow-900/40 hover:bg-yellow-900/60 border border-yellow-900/50 px-3 py-1.5 rounded-lg transition-colors"
          >
            Zu den Einstellungen →
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
