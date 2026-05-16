'use client'

import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import type { Delegation } from '@/lib/models/delegation'

interface Toast {
  id: string
  type: 'success' | 'error' | 'info'
  title: string
  message: string
  delegationId?: string
}

interface ToastContextValue {
  toasts: Toast[]
  addToast: (t: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
}

const ToastContext = createContext<ToastContextValue>({
  toasts: [],
  addToast: () => {},
  removeToast: () => {},
})

export function useToast() {
  return useContext(ToastContext)
}

const TOAST_COLORS = {
  success: 'border-green-700 bg-green-950/80',
  error:   'border-red-700 bg-red-950/80',
  info:    'border-blue-700 bg-blue-950/80',
}
const TOAST_ICONS = { success: '✅', error: '❌', info: 'ℹ️' }

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  // Track last known delegation states for completion detection
  const prevDelegationsRef = useRef<Record<string, string>>({})

  const addToast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = `toast-${Date.now()}`
    setToasts(prev => [...prev, { ...t, id }])
    // Auto-remove after 6s
    setTimeout(() => setToasts(prev => prev.filter(x => x.id !== id)), 6000)
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(x => x.id !== id))
  }, [])

  // Poll for delegation status changes to show completion notifications
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch('/api/delegations')
        const delegations = await res.json() as Delegation[]
        const prev = prevDelegationsRef.current

        for (const del of delegations) {
          const prevStatus = prev[del.id]
          if (prevStatus === 'running' && del.status === 'completed') {
            addToast({
              type: 'success',
              title: 'Agent fertig ✅',
              message: del.contract.goal.substring(0, 80),
              delegationId: del.id,
            })
          } else if (prevStatus === 'running' && del.status === 'failed') {
            addToast({
              type: 'error',
              title: 'Agent fehlgeschlagen ❌',
              message: del.contract.goal.substring(0, 80),
              delegationId: del.id,
            })
          }
          prev[del.id] = del.status
        }
      } catch {
        // ignore
      }
    }

    poll()
    const interval = setInterval(poll, 5000)
    return () => clearInterval(interval)
  }, [addToast])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      {/* Toast overlay */}
      {toasts.length > 0 && (
        <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 max-w-sm">
          {toasts.map(toast => (
            <div
              key={toast.id}
              className={`flex items-start gap-3 border rounded-xl px-4 py-3 shadow-2xl backdrop-blur-sm text-white text-sm transition-all ${TOAST_COLORS[toast.type]}`}
            >
              <span className="text-lg flex-shrink-0 mt-0.5">{TOAST_ICONS[toast.type]}</span>
              <div className="flex-1 min-w-0">
                <p className="font-bold leading-tight">{toast.title}</p>
                <p className="text-xs text-gray-300 mt-0.5 truncate">{toast.message}</p>
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="text-gray-500 hover:text-white transition-colors flex-shrink-0 mt-0.5"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  )
}
