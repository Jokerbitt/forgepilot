'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Sparkles, Zap } from 'lucide-react'
import { buttonClassName } from '@/components/ui/primitives'

const PRESETS = [
  { label: 'Todo-App', goal: 'Todo-App mit Projekten, Tags und lokaler Speicherung' },
  { label: 'REST API', goal: 'REST API mit Authentication und CRUD-Endpoints' },
  { label: 'Dashboard', goal: 'Dashboard mit Charts, Filtern und CSV-Export' },
] as const

export function AppBuilderCard() {
  const router = useRouter()
  const [goal, setGoal] = useState('')

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const trimmed = goal.trim()
    if (!trimmed) return
    router.push(`/delegations/plan?goal=${encodeURIComponent(trimmed)}`)
  }

  function applyPreset(presetGoal: string) {
    setGoal(presetGoal)
  }

  return (
    <div
      className="relative rounded-2xl p-px"
      style={{
        background:
          'linear-gradient(135deg, rgba(139,92,246,0.5) 0%, rgba(109,40,217,0.25) 50%, rgba(139,92,246,0.1) 100%)',
      }}
    >
      <div className="rounded-2xl border border-transparent bg-[#0d0d14] p-5 sm:p-7">
        {/* Header */}
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg border border-violet-500/20 bg-violet-500/10 text-violet-300">
            <Zap className="h-3.5 w-3.5" />
          </span>
          <span className="text-xs font-semibold uppercase tracking-wide text-violet-400">
            Plan Mode — für größere Features
          </span>
        </div>

        <p className="mt-3 text-lg font-semibold text-white">Was soll gebaut werden?</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          Beschreibe dein Feature oder deine App. ForgePilot erstellt einen strukturierten Plan
          und teilt die Arbeit in sichere Delegationen auf.
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <textarea
            value={goal}
            onChange={e => setGoal(e.target.value)}
            rows={3}
            placeholder="z.B. Todo-App mit Projekten, Tags und lokaler Speicherung..."
            className="w-full resize-none rounded-xl border border-violet-500/20 bg-violet-950/20 px-4 py-3 text-sm leading-6 text-white outline-none transition-colors placeholder:text-slate-600 focus:border-violet-400/60 focus:bg-violet-950/30"
          />
          <button
            type="submit"
            disabled={!goal.trim()}
            className={buttonClassName('primary', 'w-full min-h-11 disabled:opacity-40 disabled:cursor-not-allowed')}
          >
            <Sparkles className="h-4 w-4" />
            App bauen
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        {/* Presets */}
        <div className="mt-4">
          <p className="mb-2 text-xs font-medium text-slate-600">Schnell-Optionen:</p>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map(preset => (
              <button
                key={preset.label}
                type="button"
                onClick={() => applyPreset(preset.goal)}
                className="rounded-lg border border-violet-500/15 bg-violet-500/[0.07] px-3 py-1.5 text-xs font-medium text-violet-300 transition-colors hover:border-violet-400/30 hover:bg-violet-500/[0.12] hover:text-violet-200"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
