'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { BriefTemplate } from '@/lib/project-briefs/templates'
import { BRIEF_TEMPLATES } from '@/lib/project-briefs/templates'
import { buttonClassName, cx } from '@/components/ui/primitives'

function TemplateCard({
  template,
  isLoading,
  onClick,
}: {
  template: BriefTemplate
  isLoading: boolean
  onClick: (id: BriefTemplate['id']) => void
}) {
  return (
    <button
      type="button"
      disabled={isLoading}
      onClick={() => onClick(template.id)}
      className={cx(
        'flex flex-col gap-3 rounded-xl border border-slate-700/60 bg-slate-800 p-5 text-left transition-all duration-150',
        'hover:border-slate-500 hover:ring-1 hover:ring-slate-500',
        'focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:ring-offset-2 focus:ring-offset-slate-950',
        'disabled:cursor-not-allowed disabled:opacity-50',
      )}
    >
      <div className="text-2xl" role="img" aria-label={template.name}>
        {template.emoji}
      </div>
      <div>
        <p className="text-sm font-semibold text-white">{template.name}</p>
        <p className="mt-1 text-xs leading-5 text-slate-400">{template.description}</p>
      </div>
      <ul className="mt-auto space-y-1">
        {template.brief.coreFeatures.slice(0, 3).map(feature => (
          <li key={feature} className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="inline-block h-1 w-1 shrink-0 rounded-full bg-slate-600" />
            {feature}
          </li>
        ))}
      </ul>
    </button>
  )
}

export function TemplatePicker() {
  const router = useRouter()
  const [loadingId, setLoadingId] = useState<BriefTemplate['id'] | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSelectTemplate(id: BriefTemplate['id']) {
    setLoadingId(id)
    setError(null)

    try {
      const response = await fetch('/api/project-briefs/from-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: id }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({})) as { error?: string }
        throw new Error(data.error ?? `HTTP ${response.status}`)
      }

      const data = await response.json() as { id: string; redirectUrl: string }
      router.push(data.redirectUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Erstellen des Briefs.')
      setLoadingId(null)
    }
  }

  const isLoading = loadingId !== null

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Aus Vorlage starten</p>
        <p className="mt-1 text-sm text-slate-400">Wähle ein Template und ForgePilot erstellt sofort einen vorausgefüllten Projektbrief.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {BRIEF_TEMPLATES.map(template => (
          <div key={template.id} className="relative">
            <TemplateCard
              template={template}
              isLoading={isLoading}
              onClick={handleSelectTemplate}
            />
            {loadingId === template.id && (
              <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-slate-800/80">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-500 border-t-violet-400" />
              </div>
            )}
          </div>
        ))}
      </div>

      {error && (
        <p className="mt-3 text-xs text-rose-400">{error}</p>
      )}
    </div>
  )
}
