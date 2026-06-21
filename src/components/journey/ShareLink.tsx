'use client'

import { useState } from 'react'
import { toShareLink } from '@/lib/journey/share'

/**
 * Journey Companion — Phase 3.3: share the app via a link.
 * Validates the deploy URL during render (no useEffect) and warns when it is
 * only reachable locally.
 */
export function ShareLink() {
  const [url, setUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const link = url.trim() ? toShareLink(url) : null

  async function copy() {
    if (!link?.valid) return
    try { await navigator.clipboard.writeText(link.url); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* ignore */ }
  }

  return (
    <div className="mt-4 rounded-lg border border-slate-700 bg-slate-900/40 p-3">
      <p className="text-xs font-medium text-slate-300">🔗 App teilen</p>
      <p className="mt-0.5 text-[11px] text-slate-500">Trage die Adresse deiner live geschalteten App ein, um sie zu teilen.</p>
      <div className="mt-2 flex gap-2">
        <input className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
          placeholder="z.B. https://meine-app.vercel.app" value={url} onChange={e => setUrl(e.target.value)} />
        <button onClick={copy} disabled={!link?.valid}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">
          {copied ? 'Kopiert ✓' : 'Kopieren'}
        </button>
      </div>
      {link && (
        <p className={`mt-2 text-[11px] ${!link.valid ? 'text-amber-300' : link.isLocal ? 'text-amber-300' : 'text-emerald-300'}`}>
          {link.note}
        </p>
      )}
    </div>
  )
}
