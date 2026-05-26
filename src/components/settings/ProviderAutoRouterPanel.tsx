'use client'

import { useState, useEffect, useCallback } from 'react'
import type { RouterRecommendation, CLIProviderStatus, TaskComplexity } from '@/lib/ai/auto-router'

interface AutoRouteResponse {
  complexity: TaskComplexity
  recommendation: RouterRecommendation | null
  cliStatus: CLIProviderStatus
}

const COMPLEXITY_OPTIONS: { value: TaskComplexity; label: string; desc: string }[] = [
  { value: 'simple',  label: 'Einfach',  desc: 'Zusammenfassung, Triage, kurze Texte' },
  { value: 'coding',  label: 'Code',     desc: 'Implementierung, PRs, Refactoring' },
  { value: 'complex', label: 'Komplex',  desc: 'Architektur, Sicherheit, umfangreiche Analysen' },
]

function CLIBadge({ available, name, hint }: { available: boolean; name: string; hint: string }) {
  return (
    <div className="flex items-center gap-2 py-1.5">
      <span className={`h-2 w-2 rounded-full shrink-0 ${available ? 'bg-green-500' : 'bg-gray-600'}`} />
      <span className="text-sm font-medium text-gray-200 w-36">{name}</span>
      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
        available
          ? 'text-green-300 border-green-800 bg-green-950/30'
          : 'text-gray-500 border-gray-700 bg-gray-900/30'
      }`}>
        {available ? 'Installiert' : 'Nicht gefunden'}
      </span>
      <span className="text-xs text-gray-500 hidden sm:block">{hint}</span>
    </div>
  )
}

function RecommendationCard({ rec }: { rec: RouterRecommendation }) {
  const badges = [
    rec.isLocal && { label: 'Lokal', cls: 'text-violet-300 border-violet-800 bg-violet-950/20' },
    rec.isCLI  && { label: 'CLI',   cls: 'text-blue-300   border-blue-800   bg-blue-950/20'   },
    rec.isFree && { label: 'Kostenlos', cls: 'text-green-300 border-green-800 bg-green-950/20' },
    !rec.isFree && { label: `$${rec.estimatedCostPer1kTokens.toFixed(4)}/1k`, cls: 'text-yellow-300 border-yellow-800 bg-yellow-950/20' },
  ].filter(Boolean) as { label: string; cls: string }[]

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-900/40 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-gray-100">{rec.providerName}</p>
          <p className="text-xs text-gray-500 font-mono mt-0.5">{rec.model}</p>
        </div>
        <div className="flex flex-wrap gap-1 justify-end">
          {badges.map(b => (
            <span key={b.label} className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${b.cls}`}>
              {b.label}
            </span>
          ))}
        </div>
      </div>
      <p className="text-xs text-gray-400 mt-2 leading-relaxed">{rec.reason}</p>
    </div>
  )
}

export function ProviderAutoRouterPanel() {
  const [complexity, setComplexity] = useState<TaskComplexity>('coding')
  const [preferLocal, setPreferLocal] = useState(true)
  const [allowPaidAPIs, setAllowPaidAPIs] = useState(true)
  const [data, setData] = useState<AutoRouteResponse | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchRecommendation = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        complexity,
        preferLocal: String(preferLocal),
        allowPaidAPIs: String(allowPaidAPIs),
      })
      const res = await fetch(`/api/ai/auto-route?${params.toString()}`)
      if (res.ok) setData(await res.json() as AutoRouteResponse)
    } finally {
      setLoading(false)
    }
  }, [complexity, preferLocal, allowPaidAPIs])

  useEffect(() => { void fetchRecommendation() }, [fetchRecommendation])

  return (
    <div className="space-y-5">
      {/* Zero-Key CLI Section */}
      <div>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
          Ohne API-Key nutzbar
        </h3>
        <div className="rounded-xl border border-gray-800 bg-gray-900/30 px-4 py-2 space-y-0.5">
          <CLIBadge
            available={data?.cliStatus.claudeCLI ?? false}
            name="Claude CLI"
            hint="Claude Code Max-Abo → install: npm i -g @anthropic-ai/claude-code"
          />
          <CLIBadge
            available={data?.cliStatus.codexCLI ?? false}
            name="Codex CLI"
            hint="Codex Pro-Abo → install: npm i -g @openai/codex"
          />
          <CLIBadge
            available={true}
            name="Ollama"
            hint="Lokal — immer kostenlos wenn gestartet"
          />
        </div>
        <p className="text-[11px] text-gray-600 mt-1.5 leading-relaxed">
          Claude CLI und Codex CLI nutzen deine bestehenden Abonnements (Claude Code Max / Codex Pro)
          — kein separater API-Key nötig.
        </p>
      </div>

      {/* Auto-Router */}
      <div>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
          Auto-Router Empfehlung
        </h3>

        {/* Complexity selector */}
        <div className="flex gap-1.5 mb-3">
          {COMPLEXITY_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setComplexity(opt.value)}
              title={opt.desc}
              className={`flex-1 text-xs py-1.5 rounded-lg border font-medium transition-colors ${
                complexity === opt.value
                  ? 'bg-blue-900/50 text-blue-300 border-blue-700'
                  : 'text-gray-500 border-gray-800 hover:text-gray-300 hover:border-gray-700'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Preference toggles */}
        <div className="flex gap-4 mb-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={preferLocal}
              onChange={e => setPreferLocal(e.target.checked)}
              className="w-3.5 h-3.5 rounded accent-blue-500"
            />
            <span className="text-xs text-gray-400">Lokal bevorzugen</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={allowPaidAPIs}
              onChange={e => setAllowPaidAPIs(e.target.checked)}
              className="w-3.5 h-3.5 rounded accent-blue-500"
            />
            <span className="text-xs text-gray-400">Kostenpflichtige APIs erlauben</span>
          </label>
        </div>

        {loading && (
          <div className="rounded-xl border border-gray-800 bg-gray-900/30 p-3 text-xs text-gray-500 animate-pulse">
            Berechne Empfehlung…
          </div>
        )}

        {!loading && data?.recommendation && (
          <RecommendationCard rec={data.recommendation} />
        )}

        {!loading && data && !data.recommendation && (
          <div className="rounded-xl border border-yellow-900/50 bg-yellow-950/10 p-3">
            <p className="text-xs text-yellow-400">
              Kein Provider verfügbar für diese Einstellungen.
              Aktiviere einen API-Provider oder installiere Ollama / Claude CLI.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
