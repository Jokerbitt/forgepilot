'use client'

import { useState } from 'react'
import Link from 'next/link'
import { BuildProgress } from './BuildProgress'

/**
 * Journey Companion — Phase 1.3: try the app + change it in plain language.
 * Sits under a finished build; the user types what they want and a follow-up
 * build runs against the same repo, with live plain-German progress.
 */
export function AppFeedback({ targetRepo }: { targetRepo: string }) {
  const [feedback, setFeedback] = useState('')
  const [sending, setSending] = useState(false)
  const [followIds, setFollowIds] = useState<string[]>([])
  const [info, setInfo] = useState('')
  const [error, setError] = useState('')

  async function send() {
    setError(''); setInfo(''); setSending(true)
    try {
      const res = await fetch('/api/journey/feedback', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback, targetRepo }),
      })
      const data = await res.json() as { delegationIds?: string[]; step?: { title: string }; error?: string }
      if (!res.ok) { setError(data.error ?? 'Konnte die Änderung nicht starten'); return }
      setInfo(`„${data.step?.title ?? 'Änderung'}" wird umgesetzt …`)
      setFeedback('')
      setFollowIds(data.delegationIds ?? [])
    } catch { setError('Netzwerkfehler') } finally { setSending(false) }
  }

  return (
    <div className="mt-5 rounded-xl border border-slate-700 bg-slate-900/40 p-4">
      <p className="text-sm font-semibold text-slate-200">App ausprobieren & weiter verbessern</p>
      <p className="mt-1 text-xs text-slate-400">
        Schalte die App live, um sie auszuprobieren, und sag in eigenen Worten, was geändert werden soll.
      </p>
      <Link href="/deploy" className="mt-2 inline-block rounded-lg border border-slate-600 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-slate-500">
        🚀 App live schalten
      </Link>

      <textarea
        className="mt-3 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
        rows={2}
        placeholder={'Was möchtest du ändern? z.B. „Der Speichern-Button gehört nach oben" oder „Es stürzt beim Export ab"'}
        value={feedback}
        onChange={e => setFeedback(e.target.value)}
      />
      <button onClick={send} disabled={feedback.trim().length < 3 || sending}
        className="mt-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50">
        {sending ? 'Starte Änderung …' : 'Änderung umsetzen'}
      </button>

      {info && <p className="mt-2 text-xs text-emerald-300">{info}</p>}
      {error && <p className="mt-2 text-xs text-amber-300">{error}</p>}
      {followIds.length > 0 && <BuildProgress delegationIds={followIds} />}
    </div>
  )
}
