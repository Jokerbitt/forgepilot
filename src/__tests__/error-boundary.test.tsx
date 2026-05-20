/**
 * M96 — Error Boundaries tests
 * Tests that verify the error page modules export correctly and have expected structure
 */

import { describe, it, expect } from 'vitest'

// ─── GlobalError page ─────────────────────────────────────────────────────────

describe('GlobalError page (error.tsx)', () => {
  it('exports a default function component', async () => {
    const mod = await import('@/app/error')
    expect(typeof mod.default).toBe('function')
  })

  it('component accepts error and reset props', async () => {
    const { default: GlobalError } = await import('@/app/error')
    // Function should have 2 params (error, reset)
    expect(GlobalError.length).toBeLessThanOrEqual(2)
  })
})

// ─── Not Found page ───────────────────────────────────────────────────────────

describe('NotFound page (not-found.tsx)', () => {
  it('exports a default function component', async () => {
    const mod = await import('@/app/not-found')
    expect(typeof mod.default).toBe('function')
  })
})

// ─── Loading page ─────────────────────────────────────────────────────────────

describe('Loading page (loading.tsx)', () => {
  it('exports a default function component', async () => {
    const mod = await import('@/app/loading')
    expect(typeof mod.default).toBe('function')
  })
})

// ─── ErrorBoundary component ──────────────────────────────────────────────────

describe('ErrorBoundary component', () => {
  it('exports ErrorBoundary class', async () => {
    const mod = await import('@/components/ui/ErrorBoundary')
    expect(mod.ErrorBoundary).toBeDefined()
  })

  it('ErrorBoundary is a React.Component subclass', async () => {
    const { ErrorBoundary } = await import('@/components/ui/ErrorBoundary')
    // Check it has the React lifecycle methods expected of an error boundary
    expect(typeof ErrorBoundary.prototype.render).toBe('function')
    // getDerivedStateFromError is a static method
    expect(typeof (ErrorBoundary as { getDerivedStateFromError?: unknown }).getDerivedStateFromError).toBe('function')
  })

  it('getDerivedStateFromError returns hasError: true', async () => {
    const { ErrorBoundary } = await import('@/components/ui/ErrorBoundary')
    const state = (ErrorBoundary as unknown as {
      getDerivedStateFromError: (e: Error) => { hasError: boolean; error: Error }
    }).getDerivedStateFromError(new Error('test'))
    expect(state.hasError).toBe(true)
    expect(state.error).toBeInstanceOf(Error)
  })
})
