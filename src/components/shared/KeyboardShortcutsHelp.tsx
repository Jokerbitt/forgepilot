'use client'

interface ShortcutsHelpProps {
  open: boolean
  onClose: () => void
}

const SHORTCUTS: Array<{ key: string; desc: string; section: string }> = [
  { section: 'Global', key: '⌘K', desc: 'Command Palette öffnen' },
  { section: 'Global', key: '/', desc: 'Globale Suche öffnen' },
  { section: 'Global', key: '?', desc: 'Diese Hilfe anzeigen' },
  { section: 'Global', key: 'Esc', desc: 'Modal / Palette schließen' },
  { section: 'Navigation', key: 'G I', desc: 'Idea Capture (/idea)' },
  { section: 'Navigation', key: 'G D', desc: 'Delegation Queue' },
  { section: 'Navigation', key: 'G K', desc: 'Knowledge Base' },
  { section: 'Navigation', key: 'G B', desc: 'Project Briefs' },
  { section: 'Navigation', key: 'G M', desc: 'Monitor' },
  { section: 'Navigation', key: 'G A', desc: 'Active Runs' },
  { section: 'Navigation', key: 'G H', desc: 'Command Center (Home)' },
  { section: 'Navigation', key: 'G S', desc: 'Settings' },
  { section: 'Palette', key: '↑↓', desc: 'Ergebnis auswählen' },
  { section: 'Palette', key: '↵', desc: 'Zu Seite navigieren' },
]

export function KeyboardShortcutsHelp({ open, onClose }: ShortcutsHelpProps) {
  if (!open) return null

  const sections = Array.from(new Set(SHORTCUTS.map(s => s.section)))

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl shadow-black/60"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <p className="text-sm font-semibold text-white">Keyboard Shortcuts</p>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-xs">
            ✕
          </button>
        </div>
        <div className="p-4 space-y-4">
          {sections.map(section => (
            <div key={section}>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                {section}
              </p>
              <div className="space-y-1.5">
                {SHORTCUTS.filter(s => s.section === section).map(s => (
                  <div key={s.key} className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">{s.desc}</span>
                    <kbd className="rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-300">
                      {s.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-slate-800 px-4 py-2">
          <p className="text-[10px] text-slate-600">
            Drücke <kbd className="font-mono">Esc</kbd> zum Schließen
          </p>
        </div>
      </div>
    </div>
  )
}
