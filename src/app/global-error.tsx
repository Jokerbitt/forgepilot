'use client'

/**
 * global-error.tsx — Required by Sentry for React rendering error capture.
 *
 * This file wraps the root layout itself (error.tsx only wraps pages below layout).
 * Must re-render html+body since the layout may be broken.
 */

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

interface GlobalErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="de">
      <body
        style={{
          background: '#0f172a',
          color: '#f1f5f9',
          fontFamily: 'system-ui, sans-serif',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          gap: '1rem',
          padding: '2rem',
          textAlign: 'center',
        }}
      >
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>
          Kritischer Fehler
        </h1>
        <p style={{ color: '#94a3b8', maxWidth: '480px' }}>
          ForgePilot ist auf einen unerwarteten Fehler gestoßen. Bitte lade die
          Seite neu oder kontaktiere den Support.
        </p>
        {error.digest && (
          <code style={{ fontSize: '0.75rem', color: '#64748b' }}>
            Error ID: {error.digest}
          </code>
        )}
        <button
          onClick={reset}
          style={{
            marginTop: '1rem',
            padding: '0.5rem 1.5rem',
            background: '#6366f1',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.875rem',
          }}
        >
          Neu laden
        </button>
      </body>
    </html>
  )
}
