'use client'

export function RefreshButton() {
  return (
    <button
      type="button"
      onClick={() => window.location.reload()}
      className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-slate-400 transition-all hover:border-violet-500/30 hover:bg-violet-500/5 hover:text-slate-200"
    >
      Aktualisieren
    </button>
  )
}
