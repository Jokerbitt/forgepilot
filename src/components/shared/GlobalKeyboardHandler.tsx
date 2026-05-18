'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { CommandPalette } from './CommandPalette'
import { KeyboardShortcutsHelp } from './KeyboardShortcutsHelp'

const GO_SHORTCUTS: Record<string, string> = {
  i: '/inbox',
  b: '/board',
  a: '/active',
  d: '/delegations',
  h: '/',
  s: '/settings',
}

export function GlobalKeyboardHandler() {
  const router = useRouter()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [gMode, setGMode] = useState(false)
  const [gTimer, setGTimer] = useState<ReturnType<typeof setTimeout> | null>(null)

  const closePalette = useCallback(() => setPaletteOpen(false), [])
  const closeHelp = useCallback(() => setHelpOpen(false), [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore when focused in an input/textarea/select
      const tag = (e.target as HTMLElement).tagName
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target as HTMLElement).isContentEditable

      // Cmd+K / Ctrl+K — command palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setPaletteOpen(p => !p)
        setHelpOpen(false)
        return
      }

      // Escape — close all
      if (e.key === 'Escape') {
        setPaletteOpen(false)
        setHelpOpen(false)
        setGMode(false)
        return
      }

      if (isInput) return

      // ? — show shortcuts help
      if (e.key === '?' && !e.metaKey && !e.ctrlKey) {
        setHelpOpen(h => !h)
        setPaletteOpen(false)
        return
      }

      // G + key navigation
      if (gMode) {
        if (gTimer) clearTimeout(gTimer)
        setGMode(false)
        const dest = GO_SHORTCUTS[e.key.toLowerCase()]
        if (dest) {
          e.preventDefault()
          router.push(dest)
        }
        return
      }

      if (e.key.toLowerCase() === 'g' && !e.metaKey && !e.ctrlKey) {
        setGMode(true)
        const t = setTimeout(() => setGMode(false), 1500)
        setGTimer(t)
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [gMode, gTimer, router])

  return (
    <>
      {gMode && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 rounded border border-slate-700 bg-slate-900/90 px-3 py-1.5 text-xs text-slate-300 backdrop-blur">
          <kbd className="font-mono font-bold text-sky-400">G</kbd>
          <span className="ml-1.5 text-slate-500">+ i/b/a/d/h/s</span>
        </div>
      )}
      <CommandPalette open={paletteOpen} onClose={closePalette} />
      <KeyboardShortcutsHelp open={helpOpen} onClose={closeHelp} />
    </>
  )
}
