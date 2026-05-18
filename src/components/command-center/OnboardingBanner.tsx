'use client'

import { useEffect, useState } from 'react'
import type { Delegation } from '@/lib/models/delegation'
import type { ResearchDocument } from '@/lib/models/research'

const STORAGE_KEY = 'fp_onboarding_dismissed'

interface ProjectBriefSummary {
  id: string
}

async function checkIsEmpty(): Promise<boolean> {
  try {
    const [delegationsRes, briefsRes, researchRes] = await Promise.allSettled([
      fetch('/api/delegations').then(r => r.json() as Promise<Delegation[]>),
      fetch('/api/project-briefs').then(r => r.json() as Promise<ProjectBriefSummary[]>),
      fetch('/api/knowledge/research').then(r => r.json() as Promise<ResearchDocument[]>),
    ])

    const delegations = delegationsRes.status === 'fulfilled' && Array.isArray(delegationsRes.value) ? delegationsRes.value : []
    const briefs = briefsRes.status === 'fulfilled' && Array.isArray(briefsRes.value) ? briefsRes.value : []
    const research = researchRes.status === 'fulfilled' && Array.isArray(researchRes.value) ? researchRes.value : []

    return delegations.length === 0 && briefs.length === 0 && research.length === 0
  } catch {
    return false
  }
}

export function OnboardingBanner() {
  const [dismissed, setDismissed] = useState<boolean | null>(null)
  const [isEmpty, setIsEmpty] = useState(false)

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === 'true') {
        setDismissed(true)
        return
      }
    } catch { /* localStorage not available */ }

    setDismissed(false)
    checkIsEmpty().then(setIsEmpty)
  }, [])

  const handleDismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, 'true')
    } catch { /* localStorage not available */ }
    setDismissed(true)
  }

  // Not yet checked (SSR), already dismissed, or data is not empty
  if (dismissed !== false || !isEmpty) return null

  return (
    <div
      role="banner"
      aria-label="Onboarding"
      className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8"
    >
      <div className="relative rounded-xl border border-sky-700/40 bg-sky-950/20 p-5">
        <button
          onClick={handleDismiss}
          aria-label="Onboarding schließen"
          className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:text-white transition-colors"
        >
          ×
        </button>

        <p className="pr-8 text-sm font-semibold text-white">
          Willkommen bei ForgePilot 👋 — Starte mit einer Recherche, erstelle deinen ersten Brief, oder lege eine Delegation an.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <ActionCard
            href="/knowledge/research?new=1"
            emoji="🔍"
            title="Recherche starten"
            description="Lass einen Agenten ein Thema für dich recherchieren."
          />
          <ActionCard
            href="/project-briefs/new"
            emoji="📋"
            title="Brief erstellen"
            description="Definiere ein Projekt oder eine Idee als strukturierten Brief."
          />
          <ActionCard
            href="/delegations"
            emoji="🤖"
            title="Delegation erstellen"
            description='Gehe zur Delegations-Queue und klicke „+ Neue Delegation".'
          />
        </div>
      </div>
    </div>
  )
}

function ActionCard({
  href,
  emoji,
  title,
  description,
}: {
  href: string
  emoji: string
  title: string
  description: string
}) {
  return (
    <a
      href={href}
      className="flex flex-col gap-1.5 rounded-lg border border-slate-700/60 bg-slate-900/40 p-4 transition-colors hover:border-sky-700/60 hover:bg-sky-950/20"
    >
      <span className="text-xl">{emoji}</span>
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="text-xs leading-5 text-slate-400">{description}</p>
    </a>
  )
}
