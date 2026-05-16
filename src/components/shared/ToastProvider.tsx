'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { Delegation } from '@/lib/models/delegation'
import {
  buildDelegationCompletionToasts,
  type DelegationStatusSnapshot,
  type ToastPayload,
} from '@/components/shared/toast-events'

interface Toast extends ToastPayload {
  id: string
}

interface ToastContextValue {
  toasts: Toast[]
  addToast: (toast: ToastPayload) => void
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

const TOAST_COLORS: Record<Toast['type'], string> = {
  success: 'border-green-700 bg-green-950/80',
  error: 'border-red-700 bg-red-950/80',
  info: 'border-blue-700 bg-blue-950/80',
}

const TOAST_LABELS: Record<Toast['type'], string> = {
  success: 'OK',
  error: '!',
  info: 'i',
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const previousStatusesRef = useRef<DelegationStatusSnapshot>({})
  const timeoutRefs = useRef<Array<ReturnType<typeof setTimeout>>>([])

  const addToast = useCallback((toast: ToastPayload) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    setToasts(prev => [...prev, { ...toast, id }].slice(-4))

    const timeout = setTimeout(() => {
      setToasts(prev => prev.filter(current => current.id !== id))
    }, 6000)

    timeoutRefs.current.push(timeout)
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(current => current.id !== id))
  }, [])

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch('/api/delegations')
        if (!res.ok) return

        const delegations = await res.json() as Delegation[]
        const result = buildDelegationCompletionToasts(delegations, previousStatusesRef.current)
        previousStatusesRef.current = result.nextStatuses
        result.toasts.forEach(addToast)
      } catch {
        // Network hiccups should not break the app shell.
      }
    }

    poll()
    const interval = setInterval(poll, 5000)

    return () => {
      clearInterval(interval)
      timeoutRefs.current.forEach(clearTimeout)
      timeoutRefs.current = []
    }
  }, [addToast])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      {toasts.length > 0 && (
        <div className="fixed bottom-6 right-6 z-[100] flex max-w-sm flex-col gap-2">
          {toasts.map(toast => (
            <div
              key={toast.id}
              role={toast.type === 'error' ? 'alert' : 'status'}
              aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
              className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm text-white shadow-2xl backdrop-blur-sm transition-all ${TOAST_COLORS[toast.type]}`}
            >
              <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold">
                {TOAST_LABELS[toast.type]}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-bold leading-tight">{toast.title}</p>
                <p className="mt-0.5 truncate text-xs text-gray-300">{toast.message}</p>
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                aria-label="Toast schliessen"
                className="mt-0.5 flex-shrink-0 text-gray-500 transition-colors hover:text-white"
              >
                x
              </button>
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  )
}
