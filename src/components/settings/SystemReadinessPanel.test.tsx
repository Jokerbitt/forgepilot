import { describe, it, expect } from 'vitest'
import { SystemReadinessPanel, computeNextAction } from './SystemReadinessPanel'

describe('SystemReadinessPanel', () => {
  it('exports SystemReadinessPanel as a function', () => {
    expect(typeof SystemReadinessPanel).toBe('function')
  })
})

describe('computeNextAction', () => {
  it('returns null when all cards are ok', () => {
    const result = computeNextAction([
      { id: 'devserver', label: 'Dev Server', icon: '◐', status: 'ok', detail: 'läuft' },
      { id: 'runner', label: 'Runner', icon: '▶', status: 'ok', detail: 'Claude CLI' },
      { id: 'storage', label: 'Storage', icon: '⛁', status: 'ok', detail: 'PostgreSQL aktiv' },
    ])
    expect(result).toBeNull()
  })

  it('prioritizes dev server failures above all other signals', () => {
    const result = computeNextAction([
      { id: 'runner', label: 'Runner', icon: '▶', status: 'error', detail: 'Simulation', hint: 'CLI installieren' },
      { id: 'devserver', label: 'Dev Server', icon: '◐', status: 'error', detail: 'down', hint: 'npm run dev neu starten' },
      { id: 'storage', label: 'Storage', icon: '⛁', status: 'warn', detail: 'JSON', hint: 'auf Postgres wechseln' },
    ])
    expect(result).toEqual({ label: 'Dev Server: npm run dev neu starten', href: undefined })
  })

  it('surfaces runner before storage when both warn', () => {
    const result = computeNextAction([
      { id: 'devserver', label: 'Dev Server', icon: '◐', status: 'ok', detail: 'läuft' },
      { id: 'storage', label: 'Storage', icon: '⛁', status: 'warn', detail: 'JSON', hint: 'STORAGE_MODE=postgres setzen', hintHref: '/settings#storage' },
      { id: 'runner', label: 'Runner', icon: '▶', status: 'warn', detail: 'API-Key', hint: 'CLI installieren', hintHref: '/settings#api-keys' },
    ])
    expect(result).toEqual({
      label: 'Runner: CLI installieren',
      href: '/settings#api-keys',
    })
  })

  it('skips cards without a hint even if they are warn/error', () => {
    const result = computeNextAction([
      { id: 'runner', label: 'Runner', icon: '▶', status: 'warn', detail: 'API-Key' },
      { id: 'storage', label: 'Storage', icon: '⛁', status: 'warn', detail: 'JSON', hint: 'STORAGE_MODE=postgres setzen' },
    ])
    expect(result).toEqual({ label: 'Storage: STORAGE_MODE=postgres setzen', href: undefined })
  })
})
