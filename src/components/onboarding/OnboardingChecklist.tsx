'use client'

/**
 * OnboardingChecklist — "Hier starten" screen shown to first-time users.
 *
 * Displayed when isFirstRun === true AND not yet dismissed.
 * Dismissal is persisted in localStorage under 'forgepilot_onboarding_dismissed'.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { OnboardingStatus } from '@/lib/onboarding/status'

const STORAGE_KEY = 'forgepilot_onboarding_dismissed'

interface ChecklistStep {
  id: string
  label: string
  description: string
  href: string
  linkLabel: string
  isDone: boolean
}

export function OnboardingChecklist() {
  const [dismissed, setDismissed] = useState<boolean | null>(null)
  const [status, setStatus] = useState<OnboardingStatus | null>(null)

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === 'true') {
        setDismissed(true)
        return
      }
    } catch {
      // localStorage not available
    }

    setDismissed(false)

    fetch('/api/onboarding/status')
      .then(r => r.json() as Promise<OnboardingStatus>)
      .then(setStatus)
      .catch(() => {
        // silently ignore — checklist just won't show
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

  const isFirstRun = !status.hasProvider && !status.hasIdea && !status.hasDelegation

  // Only show the full checklist for first-run; otherwise the compact OnboardingBanner handles it
  if (!isFirstRun) return null

  const steps: ChecklistStep[] = [
    {
      id: 'ai_setup',
      label: 'Schritt 1: KI einrichten',
      description: 'Ollama starten oder API Key setzen',
      href: '/settings',
      linkLabel: 'Einstellungen',
      isDone: status.hasProvider,
    },
    {
      id: 'first_brief',
      label: 'Schritt 2: Ersten Projektbrief erstellen',
      description: 'Idee eingeben, KI erstellt die Struktur',
      href: '/project-briefs/new',
      linkLabel: 'Neuer Brief',
      isDone: status.hasIdea,
    },
    {
      id: 'first_delegation',
      label: 'Schritt 3: Erste Delegation',
      description: 'Aufgabe an KI delegieren und ausführen',
      href: '/delegations?new=1',
      linkLabel: 'Neue Delegation',
      isDone: status.hasDelegation,
    },
  ]

  return (
    <div
      role="region"
      aria-label="Erste Schritte mit ForgePilot"
      className="rounded-xl border border-violet-700/40 bg-violet-950/20 p-6 shadow-lg"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white">
            Willkommen bei ForgePilot
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            3 Schritte bis zum ersten echten Nutzen
          </p>
        </div>
        <button
          onClick={handleDismiss}
          aria-label="Einführung schließen"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-slate-500 transition-colors hover:text-white"
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

      {/* Steps */}
      <ol className="mt-5 space-y-3" aria-label="Setup-Schritte">
        {steps.map(step => (
          <li
            key={step.id}
            className={`flex items-start gap-4 rounded-lg border px-4 py-3 transition-colors ${
              step.isDone
                ? 'border-green-800/40 bg-green-950/20'
                : 'border-violet-800/30 bg-violet-950/10'
            }`}
          >
            {/* Status icon */}
            <span className="mt-0.5 shrink-0 text-lg leading-none" aria-hidden="true">
              {step.isDone ? '✅' : '⭕'}
            </span>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${step.isDone ? 'text-green-300' : 'text-white'}`}>
                {step.label}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">{step.description}</p>
            </div>

            {/* Action link */}
            {!step.isDone && (
              <Link
                href={step.href}
                className="shrink-0 rounded-md border border-violet-700/50 bg-violet-900/30 px-3 py-1.5 text-xs font-semibold text-violet-300 transition-colors hover:border-violet-500 hover:text-white"
              >
                {step.linkLabel} →
              </Link>
            )}
          </li>
        ))}
      </ol>

      {/* Footer */}
      <div className="mt-4 flex justify-end">
        <button
          onClick={handleDismiss}
          className="text-xs text-slate-500 transition-colors hover:text-slate-300 underline-offset-2 hover:underline"
        >
          Einführung überspringen
        </button>
      </div>
    </div>
  )
}
