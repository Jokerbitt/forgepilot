'use client'
import { useState } from 'react'
import type { CriticReview, CriticSuggestion } from '@/lib/brief-critic/types'

interface Props {
  briefId: string
  onApplied: () => void
}

export function BriefCriticPanel({ briefId, onApplied }: Props) {
  const [loading, setLoading] = useState(false)
  const [review, setReview] = useState<CriticReview | null>(null)
  const [applying, setApplying] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function runReview() {
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/project-briefs/${briefId}/critic-review`, { method: 'POST' })
      if (!res.ok) throw new Error('Review failed')
      const data = await res.json() as { review: CriticReview }
      setReview(data.review)
    } catch { setError('Kritik fehlgeschlagen — API Key konfiguriert?') }
    finally { setLoading(false) }
  }

  async function applySuggestion(s: CriticSuggestion) {
    setApplying(s.id)
    try {
      const res = await fetch(`/api/project-briefs/${briefId}/critic-apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suggestionId: s.id }),
      })
      if (!res.ok) throw new Error('Apply failed')
      onApplied()
    } catch { setError('Vorschlag konnte nicht angewendet werden') }
    finally { setApplying(null) }
  }

  async function acceptAsIs() {
    try {
      await fetch(`/api/project-briefs/${briefId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'accepted' }),
      })
      onApplied()
    } catch { setError('Fehler beim Annehmen') }
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold">🧠 KI-Kritiker</h3>
        {!review && (
          <button onClick={runReview} disabled={loading}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm rounded-lg font-medium transition-colors">
            {loading ? 'Analysiere…' : 'Brief prüfen'}
          </button>
        )}
      </div>

      {error && <div className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg p-3">{error}</div>}

      {review && (
        <div className="space-y-4">
          <div className={`px-3 py-2 rounded-lg text-sm font-medium border ${
            review.verdict === 'approved'
              ? 'bg-green-900/30 text-green-400 border-green-800'
              : 'bg-yellow-900/30 text-yellow-400 border-yellow-800'
          }`}>
            {review.verdict === 'approved' ? '✅ Brief sieht gut aus' : '⚠️ Verbesserungen empfohlen'}
          </div>

          {review.issues.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Probleme</p>
              {review.issues.map((issue, i) => (
                <div key={i} className="flex gap-2 text-sm text-gray-300">
                  <span className="text-yellow-500">•</span><span>{issue}</span>
                </div>
              ))}
            </div>
          )}

          {review.suggestions.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Wähle einen Verbesserungsvorschlag</p>
              {review.suggestions.map((s, idx) => (
                <div key={s.id} className="border border-gray-700 rounded-lg p-4 space-y-2 hover:border-purple-600 transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded font-mono">
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span className="text-white text-sm font-medium">{s.title}</span>
                  </div>
                  <p className="text-gray-400 text-xs">{s.summary}</p>
                  {Object.entries(s.patch).map(([field, value]) => (
                    <div key={field} className="bg-gray-800 rounded p-2 text-xs">
                      <span className="text-purple-400 font-mono">{field}: </span>
                      <span className="text-gray-300">
                        {Array.isArray(value) ? value.join(', ') : String(value).slice(0, 150)}
                        {!Array.isArray(value) && String(value).length > 150 ? '…' : ''}
                      </span>
                    </div>
                  ))}
                  <button onClick={() => applySuggestion(s)} disabled={applying !== null}
                    className="w-full mt-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs rounded-lg font-medium transition-colors">
                    {applying === s.id ? 'Wird angewendet…' : 'Übernehmen & Brief annehmen'}
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="pt-2 border-t border-gray-800">
            <button onClick={acceptAsIs}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors underline">
              {review.verdict === 'approved' ? '✅ Brief so annehmen' : 'Trotzdem so annehmen (ohne Änderungen)'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
