'use client'

/**
 * OnboardingBanner — dismissible banner shown on the homepage
 * when the onboarding wizard is not yet complete.
 *
 * Reads status from /api/onboarding/status on mount.
 * Dismissal is persisted in localStorage under 'fp-onboarding-dismissed'.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { OnboardingStatus } from '@/lib/onboarding/status'

const STORAGE_KEY = 'fp-onboarding-dismissed'

export function OnboardingBanner() {
  const [dismissed, setDismissed] = useState<boolean | null>(null)
  const [status, setStatus] = useState<OnboardingStatus | null>(null)

  useEffect(() => {
    // Check dismissal first
    try {
      if (localStorage.getItem(STORAGE_KEY) === 'true') {
        setDismissed(true)
        return
      }
    } catch {
      // localStorage not available
    }

    setDismissed(false)

    // Fetch status
    fetch('/api/onboarding/status')
      .then(r => r.json() as Promise<OnboardingStatus>)
      .then(setStatus)
      .catch(() => {
        // silently ignore — banner just won't show
      })
  }, [])

  const handleDismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, 'true')
    } catch {
      // localStorage not available
    }
    setDismissed(true)
  }

  // Not yet initialised, already dismissed, or setup complete
  if (dismissed !== false || status === null || status.isComplete) return null

  return (
    <div
      role="banner"
      aria-label="Onboarding-Fortschritt"
      className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8"
    >
      <div className="relative flex items-center justify-between gap-4 rounded-xl border border-violet-700/40 bg-violet-950/20 px-5 py-3.5">
        <div className="flex items-center gap-3">
          {/* Progress indicator */}
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-600/20">
            <span className="text-xs font-bold text-violet-300">{status.completedSteps}</span>
          </div>

          <p className="text-sm text-slate-300">
            <span className="font-semibold text-white">Erste Schritte:</span>{' '}
            {status.completedSteps} von {status.totalSteps} abgeschlossen —{' '}
            <Link
              href="/onboarding"
              className="text-violet-300 underline-offset-2 hover:underline"
            >
              Setup fortsetzen
            </Link>
          </p>
        </div>

        <button
          onClick={handleDismiss}
          aria-label="Onboarding-Banner schließen"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-400 transition-colors hover:text-white"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
        </button>
      </div>
    </div>
  )
}
