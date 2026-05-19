'use client'

/**
 * React Error Boundary Component — M96
 *
 * Wraps critical UI sections to catch runtime errors without crashing
 * the entire page. Used for AI widgets, delegation cards, charts.
 *
 * Usage:
 *   <ErrorBoundary fallback={<p>Widget unavailable</p>}>
 *     <AIWidget />
 *   </ErrorBoundary>
 */

import React from 'react'

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
  label?: string  // Used in error message for debugging
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[ErrorBoundary:${this.props.label ?? 'unknown'}]`, error, info.componentStack)
  }

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="rounded-lg border border-red-900/30 bg-red-950/10 px-4 py-3 text-sm text-red-400">
          <span className="font-medium">Widget nicht verfügbar</span>
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <p className="mt-1 text-xs text-red-600 font-mono">{this.state.error.message}</p>
          )}
        </div>
      )
    }

    return this.props.children
  }
}

/** Functional convenience wrapper for the class-based ErrorBoundary */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  label?: string,
): React.ComponentType<P> {
  const Wrapped = (props: P) => (
    <ErrorBoundary label={label}>
      <Component {...props} />
    </ErrorBoundary>
  )
  Wrapped.displayName = `WithErrorBoundary(${Component.displayName ?? Component.name})`
  return Wrapped
}
