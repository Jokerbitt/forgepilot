'use client'

import { useState } from 'react'
import Link from 'next/link'
import { BuildProgress } from './BuildProgress'
import { DataImport } from './DataImport'
import { Snapshots } from './Snapshots'
import { MobileCheck } from './MobileCheck'
import { ShareLink } from './ShareLink'
import { FunctionProof } from './FunctionProof'
import { Monitoring } from './Monitoring'
import { Maintenance } from './Maintenance'
import { NextSteps } from './NextSteps'

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

  const blocks: Array<{ id: string; label: string; emoji: string }> = [
    { id: 'login', label: 'Login & Registrierung', emoji: '🔑' },
    { id: 'payments', label: 'Zahlungen', emoji: '💳' },
    { id: 'email', label: 'E-Mail-Versand', emoji: '✉️' },
    { id: 'notifications', label: 'Benachrichtigungen', emoji: '🔔' },
    { id: 'file-upload', label: 'Datei-Upload', emoji: '📎' },
    { id: 'search', label: 'Suche', emoji: '🔎' },
  ]

  async function addBlock(blockId: string, label: string) {
    setError(''); setInfo(''); setSending(true)
    try {
      const res = await fetch('/api/journey/block', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blockId, targetRepo }),
      })
      const data = await res.json() as { delegationIds?: string[]; error?: string }
      if (!res.ok) { setError(data.error ?? 'Konnte den Baustein nicht hinzufügen'); return }
      setInfo(`„${label}" wird hinzugefügt …`)
      setFollowIds(data.delegationIds ?? [])
    } catch { setError('Netzwerkfehler') } finally { setSending(false) }
  }

  async function downloadBackup() {
    setError('')
    try {
      const res = await fetch('/api/journey/export', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetRepo }),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})) as { error?: string }; setError(d.error ?? 'Backup fehlgeschlagen'); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = 'app-backup.zip'; a.click()
      URL.revokeObjectURL(url)
    } catch { setError('Netzwerkfehler') }
  }

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
      <div className="mt-2 flex flex-wrap gap-2">
        <Link href="/deploy" className="inline-block rounded-lg border border-slate-600 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-slate-500">
          🚀 App live schalten
        </Link>
        <button onClick={downloadBackup} className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-slate-500">
          💾 Backup (.zip)
        </button>
      </div>

      <div className="mt-4"><NextSteps targetRepo={targetRepo} /></div>

      <p className="mt-4 text-xs font-medium text-slate-300">Fertige Bausteine hinzufügen:</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {blocks.map(b => (
          <button key={b.id} onClick={() => addBlock(b.id, b.label)} disabled={sending}
            className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-200 transition hover:border-indigo-500 disabled:opacity-50">
            {b.emoji} {b.label}
          </button>
        ))}
      </div>

      <p className="mt-4 text-xs font-medium text-slate-300">…oder in eigenen Worten beschreiben:</p>
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

      <DataImport targetRepo={targetRepo} />
      <MobileCheck targetRepo={targetRepo} />
      <Maintenance targetRepo={targetRepo} />
      <Snapshots targetRepo={targetRepo} />
      <FunctionProof />
      <Monitoring />
      <ShareLink />
    </div>
  )
}
