'use client'

import { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'
import { getTheme, setTheme, type Theme } from '@/lib/theme/theme-store'

export function ThemeToggle() {
  const [theme, setLocalTheme] = useState<Theme>('dark')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setLocalTheme(getTheme())
    setMounted(true)
  }, [])

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    setLocalTheme(next)
  }

  // Avoid hydration mismatch — render placeholder until mounted
  if (!mounted) {
    return (
      <button
        aria-label="Toggle theme"
        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500"
        disabled
      >
        <Moon className="h-4 w-4" />
      </button>
    )
  }

  return (
    <button
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-slate-200 dark:text-slate-400 dark:hover:bg-white/[0.06] dark:hover:text-slate-200"
    >
      {theme === 'dark' ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </button>
  )
}
