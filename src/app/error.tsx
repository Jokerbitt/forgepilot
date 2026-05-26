'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { captureError } from '@/lib/logger/browser'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    captureError(error, 'page.crash')
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-zinc-950 p-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full border border-rose-500/30 bg-rose-500/10">
          <span className="text-2xl">⚠</span>
        </div>
        <h1 className="text-2xl font-semibold text-white">Etwas ist schiefgelaufen</h1>
        <p className="max-w-md text-sm text-slate-400">
          Ein unerwarteter Fehler ist aufgetreten. Du kannst die Seite neu laden oder zur Startseite wechseln.
        </p>
        {process.env.NODE_ENV === 'development' && (
          <details className="mt-2 max-w-lg text-left">
            <summary className="cursor-pointer text-xs text-slate-500">Fehlerdetails (Dev)</summary>
            <pre className="mt-2 overflow-auto rounded-lg border border-white/[0.06] bg-black/40 p-3 text-xs text-rose-300">
              {error.message}
              {error.stack && '\n\n' + error.stack}
            </pre>
          </details>
        )}
      </div>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="rounded-lg border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/10"
        >
          Neu laden
        </button>
        <Link
          href="/"
          className="rounded-lg border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/10"
        >
          Startseite
        </Link>
      </div>
    </div>
  )
}
