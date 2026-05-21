/**
 * Onboarding Wizard — 3-step setup flow
 *
 * Server Component: fetches onboarding status from the API
 * and renders a visual stepper.
 */

import Link from 'next/link'
import type { OnboardingStatus } from '@/lib/onboarding/status'

// ─── Step definitions ─────────────────────────────────────────────────────────

interface WizardStep {
  number: number
  title: string
  description: string
  href: string
  ctaLabel: string
  done: boolean
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepIndicator({ done, number }: { done: boolean; number: number }) {
  if (done) {
    return (
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-600">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-5 w-5 text-white"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
            clipRule="evenodd"
          />
        </svg>
      </div>
    )
  }

  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/5">
      <span className="text-sm font-semibold text-slate-400">{number}</span>
    </div>
  )
}

function WizardStepCard({ step }: { step: WizardStep }) {
  return (
    <div
      className={[
        'flex items-start gap-4 rounded-xl border p-5 transition-colors',
        step.done
          ? 'border-violet-500/30 bg-violet-950/20'
          : 'border-white/[0.08] bg-white/[0.03]',
      ].join(' ')}
    >
      <StepIndicator done={step.done} number={step.number} />

      <div className="flex flex-1 flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h2
            className={[
              'text-sm font-semibold',
              step.done ? 'text-violet-300' : 'text-white',
            ].join(' ')}
          >
            {step.title}
          </h2>
          {step.done && (
            <span className="rounded-full bg-violet-600/20 px-2 py-0.5 text-xs font-medium text-violet-300">
              Erledigt
            </span>
          )}
        </div>

        <p className="text-sm leading-6 text-slate-400">{step.description}</p>

        {!step.done && (
          <Link
            href={step.href}
            className="mt-1 w-fit rounded-lg bg-violet-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-violet-500"
          >
            {step.ctaLabel}
          </Link>
        )}
      </div>
    </div>
  )
}

function CompletionBanner() {
  return (
    <div
      role="status"
      className="flex items-center gap-3 rounded-xl border border-violet-500/40 bg-violet-950/30 px-5 py-4"
    >
      <span className="text-xl" aria-hidden="true">
        🎉
      </span>
      <div>
        <p className="text-sm font-semibold text-violet-300">Du bist bereit!</p>
        <p className="text-sm text-slate-400">
          Alle Schritte abgeschlossen — ForgePilot ist einsatzbereit.
        </p>
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildSteps(status: OnboardingStatus): WizardStep[] {
  return [
    {
      number: 1,
      title: 'AI Provider einrichten',
      description:
        'Verbinde einen KI-Anbieter (z.B. Anthropic, OpenAI, Ollama) mit einem API-Key, damit ForgePilot Aufgaben ausführen kann.',
      href: '/settings',
      ctaLabel: 'Zu den Einstellungen',
      done: status.hasProvider,
    },
    {
      number: 2,
      title: 'Erste Idee eingeben',
      description:
        'Beschreibe eine Idee oder ein Projekt — ForgePilot erstellt daraus einen strukturierten Brief mit Aufgaben.',
      href: '/idea',
      ctaLabel: 'Idee eingeben',
      done: status.hasIdea,
    },
    {
      number: 3,
      title: 'Erste Delegation starten',
      description:
        'Delegiere eine Aufgabe an einen Agenten — ForgePilot arbeitet sie autonom ab und meldet sich bei Fragen.',
      href: '/delegations',
      ctaLabel: 'Delegation erstellen',
      done: status.hasDelegation,
    },
  ]
}

// ─── Data fetching ────────────────────────────────────────────────────────────

async function fetchOnboardingStatus(): Promise<OnboardingStatus> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/onboarding/status`, {
      cache: 'no-store',
    })
    if (!res.ok) throw new Error('Failed to fetch onboarding status')
    return res.json() as Promise<OnboardingStatus>
  } catch {
    // Fallback: all incomplete
    return {
      hasProvider: false,
      hasIdea: false,
      hasDelegation: false,
      isComplete: false,
      completedSteps: 0,
      totalSteps: 3,
    }
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function OnboardingPage() {
  const status = await fetchOnboardingStatus()
  const steps = buildSteps(status)

  return (
    <main className="min-h-screen bg-[#07070c] text-white">
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="mb-8">
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-violet-400">
            Setup
          </p>
          <h1 className="text-2xl font-bold text-white">Erste Schritte</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Schliesse diese 3 Schritte ab, um ForgePilot vollständig einzurichten.
          </p>
        </header>

        {/* Progress bar */}
        <div className="mb-6">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              {status.completedSteps} von {status.totalSteps} abgeschlossen
            </span>
            <span className="text-xs text-violet-300">
              {Math.round((status.completedSteps / status.totalSteps) * 100)}%
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-violet-500 transition-all duration-500"
              style={{ width: `${(status.completedSteps / status.totalSteps) * 100}%` }}
              role="progressbar"
              aria-valuenow={status.completedSteps}
              aria-valuemin={0}
              aria-valuemax={status.totalSteps}
            />
          </div>
        </div>

        {/* Completion banner */}
        {status.isComplete && (
          <div className="mb-6">
            <CompletionBanner />
          </div>
        )}

        {/* Steps */}
        <div className="flex flex-col gap-3">
          {steps.map(step => (
            <WizardStepCard key={step.number} step={step} />
          ))}
        </div>

        {/* Back to dashboard */}
        <div className="mt-8 text-center">
          <Link href="/" className="text-sm text-slate-400 hover:text-white transition-colors">
            ← Zurück zum Command Center
          </Link>
        </div>
      </div>
    </main>
  )
}
