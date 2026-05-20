'use client'

/**
 * Global Error Boundary — M96
 *
 * Next.js 14 App Router: this file is automatically used as an error boundary
 * for all pages. It must be a Client Component.
 */

import { useEffect } from 'react'
import Link from 'next/link'

interface ErrorPageProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    // In dev: log to console; in prod: Sentry captures it (M97)
    if (process.env.NODE_ENV === 'development') {
      console.error('[ForgePilot] Page error:', error)
    }
    // Dynamic import — no-op when Sentry DSN is not configured
    import('@sentry/nextjs').then(Sentry => {
      Sentry.captureException(error)
    }).catch(() => { /* Sentry not initialised */ })
  }, [error])

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6">

        <div className="text-5xl">⚠️</div>

        <div>
          <h1 className="text-xl font-semibold text-white mb-2">Etwas ist schiefgelaufen</h1>
          <p className="text-sm text-slate-400">
            Ein unerwarteter Fehler ist aufgetreten. Die Seite konnte nicht geladen werden.
          </p>
        </div>

        {process.env.NODE_ENV === 'development' && (
          <details className="text-left bg-slate-900 border border-red-900/40 rounded-lg p-4">
            <summary className="text-xs text-red-400 cursor-pointer font-mono mb-2">
              Stack Trace (nur in Entwicklung sichtbar)
            </summary>
            <pre className="text-xs text-slate-400 overflow-auto max-h-48 whitespace-pre-wrap">
              {error.message}
              {error.stack ? `\n\n${error.stack}` : ''}
            </pre>
          </details>
        )}

        {error.digest && (
          <p className="text-xs text-slate-600 font-mono">Error ID: {error.digest}</p>
        )}

        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            ↺ Seite neu laden
          </button>
          <Link
            href="/"
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-lg transition-colors"
          >
            ← Command Center
          </Link>
        </div>

      </div>
    </div>
  )
}
