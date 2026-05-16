'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import type { Delegation } from '@/lib/models/delegation'

export function AppNav() {
  const pathname = usePathname()
  const [running, setRunning] = useState(0)
  const [pending, setPending] = useState(0)

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/delegations')
        const data = await res.json() as Delegation[]
        if (Array.isArray(data)) {
          setRunning(data.filter(d => d.status === 'running').length)
          setPending(data.filter(d => d.status === 'pending' || d.status === 'approved').length)
        }
      } catch {
        // ignore — nav badge is non-critical
      }
    }
    fetchStatus()
    const interval = setInterval(fetchStatus, 8000)
    return () => clearInterval(interval)
  }, [])

  const totalActive = running + pending

  return (
    <nav className="sticky top-0 z-50 bg-gray-950/95 backdrop-blur-sm border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 text-white font-bold text-base hover:text-blue-400 transition-colors">
            <span className="text-xl">⚙️</span>
            <span className="hidden sm:block">ForgePilot</span>
          </Link>

          {/* Nav links */}
          <div className="flex items-center gap-1">
            {/* Dashboard */}
            <Link
              href="/"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                pathname === '/'
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-900'
              }`}
            >
              <span className="text-base leading-none">🏠</span>
              <span className="hidden sm:block">Dashboard</span>
            </Link>

            {/* Delegationen — with live badge */}
            <Link
              href="/delegations"
              className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                pathname.startsWith('/delegations')
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-900'
              }`}
            >
              <span className="text-base leading-none">⚡</span>
              <span className="hidden sm:block">Delegationen</span>
              {totalActive > 0 && (
                <span
                  className={`ml-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center leading-none ${
                    running > 0
                      ? 'bg-green-500 text-white animate-pulse'
                      : 'bg-yellow-500 text-gray-900'
                  }`}
                  title={running > 0 ? `${running} laufend` : `${pending} ausstehend`}
                >
                  {totalActive}
                </span>
              )}
            </Link>

            {/* Einstellungen */}
            <Link
              href="/settings"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                pathname.startsWith('/settings')
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-900'
              }`}
            >
              <span className="text-base leading-none">⚙️</span>
              <span className="hidden sm:block">Einstellungen</span>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  )
}
