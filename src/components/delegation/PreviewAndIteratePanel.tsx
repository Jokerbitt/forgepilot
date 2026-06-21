'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ExternalLink, FolderOpen, Loader2, Monitor, Play, RefreshCw, Send, StopCircle } from 'lucide-react'
import { cx } from '@/components/ui/primitives'
import { useToast } from '@/components/shared/ToastProvider'
import type { Delegation } from '@/lib/models/delegation'

interface PreviewResponse {
  url: string | null
  appType: 'static' | 'nextjs' | 'vite' | 'unknown' | null
  repoPath: string | null
  restarted?: boolean
}

interface Props {
  delegation: Delegation
}

const APP_TYPE_LABEL: Record<string, string> = {
  static:  'Statische HTML-App',
  nextjs:  'Next.js App',
  vite:    'Vite App',
  unknown: 'Unbekannter App-Typ',
}

const APP_TYPE_COLOR: Record<string, string> = {
  static:  'text-emerald-300 border-emerald-700/40 bg-emerald-950/20',
  nextjs:  'text-violet-300 border-violet-700/40 bg-violet-950/20',
  vite:    'text-amber-300 border-amber-700/40 bg-amber-950/20',
  unknown: 'text-slate-400 border-slate-700/40 bg-slate-950/20',
}

export function PreviewAndIteratePanel({ delegation }: Props) {
  const router = useRouter()
  const { addToast } = useToast()
  const id = delegation.id

  const [previewState, setPreviewState] = useState<PreviewResponse | null>(null)
  const [starting, setStarting] = useState(false)
  const [stopping, setStopping] = useState(false)
  const [iframeKey, setIframeKey] = useState(0)
  const [feedback, setFeedback] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)

  const handleStart = async () => {
    setStarting(true)
    try {
      const res = await fetch(`/api/delegations/${id}/preview`, { method: 'POST' })
      const data = await res.json() as PreviewResponse & { error?: string }
      if (!res.ok) {
        addToast({ type: 'error', title: 'Vorschau-Fehler', message: data.error ?? 'Server konnte nicht gestartet werden' })
        return
      }
      setPreviewState(data)
      if (data.url) {
        addToast({ type: 'success', title: 'Vorschau gestartet', message: `${APP_TYPE_LABEL[data.appType ?? 'unknown']} läuft auf ${data.url}` })
      } else if (data.repoPath) {
        addToast({ type: 'info', title: 'App-Ordner verfügbar', message: 'Kein Web-Server erkannt — Ordner kann im Finder geöffnet werden' })
      }
    } catch {
      addToast({ type: 'error', title: 'Netzwerkfehler', message: 'Vorschau-Server konnte nicht gestartet werden' })
    } finally {
      setStarting(false)
    }
  }

  const handleStop = async () => {
    setStopping(true)
    try {
      await fetch(`/api/delegations/${id}/preview`, { method: 'DELETE' })
      setPreviewState(null)
    } finally {
      setStopping(false)
    }
  }

  const handleOpenInFinder = async () => {
    const repoPath = previewState?.repoPath ?? delegation.worktreePath
    if (!repoPath) {
      addToast({ type: 'error', title: 'Kein Workspace-Pfad', message: 'Workspace-Pfad ist nicht verfügbar' })
      return
    }
    // Use the open command (macOS) to open the folder in Finder
    await fetch('/api/system/open-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: repoPath }),
    }).catch(() => {})
    addToast({ type: 'info', title: 'Öffne im Finder', message: repoPath })
  }

  const handleOpenInVSCode = async () => {
    const repoPath = previewState?.repoPath ?? delegation.worktreePath
    if (!repoPath) return
    await fetch('/api/system/open-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: repoPath, app: 'vscode' }),
    }).catch(() => {})
  }

  const handleSubmitFeedback = async () => {
    if (!feedback.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/delegations/${id}/preview/fix`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback: feedback.trim() }),
      })
      const data = await res.json() as { delegationId?: string; error?: string }
      if (!res.ok || !data.delegationId) {
        addToast({ type: 'error', title: 'Fix-Delegation fehlgeschlagen', message: data.error ?? 'Unbekannter Fehler' })
        return
      }
      addToast({ type: 'success', title: 'Fix-Delegation erstellt', message: 'Agent wird das Problem beheben' })
      setFeedback('')
      setShowFeedback(false)
      router.push(`/delegations/${data.delegationId}`)
    } catch {
      addToast({ type: 'error', title: 'Netzwerkfehler', message: 'Fix-Delegation konnte nicht erstellt werden' })
    } finally {
      setSubmitting(false)
    }
  }

  const workspacePath = previewState?.repoPath ?? delegation.worktreePath
  const isCompleted = delegation.status === 'completed'
  if (!isCompleted) return null

  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <Monitor className="h-4 w-4 text-violet-400" />
          <span className="text-sm font-semibold text-white">Vorschau & Testen</span>
          {previewState?.appType && (
            <span className={cx('text-[10px] font-medium px-1.5 py-0.5 rounded border', APP_TYPE_COLOR[previewState.appType])}>
              {APP_TYPE_LABEL[previewState.appType]}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {previewState?.url && (
            <button
              onClick={() => setIframeKey(k => k + 1)}
              title="Neu laden"
              className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-1.5 text-slate-500 hover:text-slate-300 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          )}
          {!previewState ? (
            <button
              onClick={handleStart}
              disabled={starting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-500 disabled:opacity-50"
            >
              {starting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              {starting ? 'Startet…' : 'Vorschau starten'}
            </button>
          ) : (
            <button
              onClick={handleStop}
              disabled={stopping}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-800/40 bg-red-950/20 px-3 py-1.5 text-xs font-semibold text-red-400 transition hover:bg-red-950/40 disabled:opacity-50"
            >
              <StopCircle className="h-3.5 w-3.5" />
              {stopping ? 'Stoppt…' : 'Stoppen'}
            </button>
          )}
        </div>
      </div>

      {/* Iframe preview */}
      {previewState?.url && (
        <div className="relative">
          <iframe
            key={iframeKey}
            src={previewState.url}
            title="App-Vorschau"
            className="w-full border-0 bg-white"
            style={{ height: '480px' }}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
          <a
            href={previewState.url}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-lg border border-white/20 bg-black/60 px-2 py-1 text-[10px] text-slate-300 hover:text-white transition backdrop-blur-sm"
          >
            <ExternalLink className="h-3 w-3" />
            Im Browser öffnen
          </a>
        </div>
      )}

      {/* No URL but app type known — show helpful message */}
      {previewState && !previewState.url && (
        <div className="px-4 py-5 text-center">
          <p className="text-sm text-slate-400">
            {previewState.appType === 'nextjs' && 'Next.js App wird gestartet — dies kann einige Sekunden dauern.'}
            {previewState.appType === 'vite' && 'Vite Dev-Server startet…'}
            {previewState.appType === 'unknown' && 'Kein Web-Server erkannt. Öffne den Ordner und starte die App manuell.'}
          </p>
          {previewState.repoPath && (
            <p className="mt-2 text-xs text-slate-600 font-mono break-all">{previewState.repoPath}</p>
          )}
        </div>
      )}

      {/* Workspace actions + feedback */}
      <div className="border-t border-white/[0.06] px-4 py-3 space-y-3">
        {/* Workspace path + open buttons */}
        {workspacePath && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-slate-600 font-mono flex-1 min-w-0 truncate" title={workspacePath}>
              📁 {workspacePath}
            </span>
            <button
              onClick={handleOpenInFinder}
              className="inline-flex items-center gap-1 rounded-md border border-white/[0.07] bg-white/[0.03] px-2 py-1 text-[10px] font-medium text-slate-400 hover:text-slate-200 hover:border-white/[0.12] transition-colors"
            >
              <FolderOpen className="h-3 w-3" />
              Im Finder öffnen
            </button>
            <button
              onClick={handleOpenInVSCode}
              className="inline-flex items-center gap-1 rounded-md border border-white/[0.07] bg-white/[0.03] px-2 py-1 text-[10px] font-medium text-slate-400 hover:text-slate-200 hover:border-white/[0.12] transition-colors"
            >
              <span className="text-xs">⌨</span>
              In VS Code
            </button>
          </div>
        )}

        {/* Feedback / Fix loop */}
        {!showFeedback ? (
          <button
            onClick={() => setShowFeedback(true)}
            className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
          >
            ✦ Etwas stimmt nicht? Feedback geben → Agent behebt es
          </button>
        ) : (
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Was funktioniert nicht oder soll anders aussehen?
            </label>
            <textarea
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              rows={3}
              placeholder="z.B. Der Login-Button reagiert nicht. Das Layout bricht auf Mobile. Die Farben passen nicht zum Branding…"
              className="w-full resize-none rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/25"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={handleSubmitFeedback}
                disabled={!feedback.trim() || submitting}
                className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-500 disabled:opacity-50"
              >
                {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                {submitting ? 'Erstellt Fix-Delegation…' : 'Agent beauftragen'}
              </button>
              <button
                onClick={() => { setShowFeedback(false); setFeedback('') }}
                className="text-xs text-slate-600 hover:text-slate-400 transition-colors"
              >
                Abbrechen
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
