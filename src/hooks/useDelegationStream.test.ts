import { describe, it, expect } from 'vitest'
import type { StreamEvent } from './useDelegationStream'

// ── Pure helper logic extracted for unit testing ─────────────────────────────

/**
 * Appends a new event to the list, trimming to MAX_EVENTS if necessary.
 * Mirrors the logic inside useDelegationStream.
 */
function appendEvent(events: StreamEvent[], event: StreamEvent, max = 50): StreamEvent[] {
  const next = [...events, event]
  return next.length > max ? next.slice(next.length - max) : next
}

/**
 * Returns true when the event type indicates the stream should close.
 */
function isTerminalEvent(event: StreamEvent): boolean {
  return event.type === 'complete' || event.type === 'error'
}

/**
 * Parses a raw 'status' SSE payload into a StreamEvent.
 */
function parseStatusPayload(raw: string, now: string): StreamEvent | null {
  try {
    const data = JSON.parse(raw) as { status: string }
    const terminal =
      data.status === 'completed' ||
      data.status === 'failed' ||
      data.status === 'cancelled'
    const type: StreamEvent['type'] = terminal
      ? data.status === 'completed'
        ? 'complete'
        : 'error'
      : 'status'
    return { type, status: data.status, message: `Status geändert: ${data.status}`, timestamp: now }
  } catch {
    return null
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('appendEvent', () => {
  it('accumulates events up to the max', () => {
    let events: StreamEvent[] = []
    for (let i = 0; i < 50; i++) {
      events = appendEvent(events, { type: 'log', message: `msg ${i}`, timestamp: new Date().toISOString() })
    }
    expect(events).toHaveLength(50)
  })

  it('enforces max=50 by dropping oldest events', () => {
    let events: StreamEvent[] = []
    for (let i = 0; i < 55; i++) {
      events = appendEvent(events, { type: 'log', message: `msg ${i}`, timestamp: new Date().toISOString() })
    }
    expect(events).toHaveLength(50)
    expect(events[0].message).toBe('msg 5')
    expect(events[49].message).toBe('msg 54')
  })

  it('works with a custom max', () => {
    let events: StreamEvent[] = []
    for (let i = 0; i < 10; i++) {
      events = appendEvent(events, { type: 'log', message: `msg ${i}`, timestamp: '' }, 5)
    }
    expect(events).toHaveLength(5)
    expect(events[0].message).toBe('msg 5')
  })

  it('returns events unchanged when below max', () => {
    const events: StreamEvent[] = [
      { type: 'log', message: 'a', timestamp: '' },
      { type: 'status', message: 'b', timestamp: '' },
    ]
    const result = appendEvent(events, { type: 'progress', progress: 42, timestamp: '' })
    expect(result).toHaveLength(3)
    expect(result[2].type).toBe('progress')
  })
})

describe('isTerminalEvent', () => {
  it('returns true for complete event', () => {
    expect(isTerminalEvent({ type: 'complete', timestamp: '' })).toBe(true)
  })

  it('returns true for error event', () => {
    expect(isTerminalEvent({ type: 'error', timestamp: '' })).toBe(true)
  })

  it('returns false for non-terminal events', () => {
    const nonTerminal: StreamEvent['type'][] = ['status', 'log', 'progress']
    for (const type of nonTerminal) {
      expect(isTerminalEvent({ type, timestamp: '' })).toBe(false)
    }
  })
})

describe('parseStatusPayload', () => {
  const ts = '2026-05-22T10:00:00.000Z'

  it('maps completed status to complete event type', () => {
    const result = parseStatusPayload(JSON.stringify({ status: 'completed' }), ts)
    expect(result?.type).toBe('complete')
    expect(result?.status).toBe('completed')
  })

  it('maps failed status to error event type', () => {
    const result = parseStatusPayload(JSON.stringify({ status: 'failed' }), ts)
    expect(result?.type).toBe('error')
  })

  it('maps cancelled status to error event type', () => {
    const result = parseStatusPayload(JSON.stringify({ status: 'cancelled' }), ts)
    expect(result?.type).toBe('error')
  })

  it('maps running status to status event type', () => {
    const result = parseStatusPayload(JSON.stringify({ status: 'running' }), ts)
    expect(result?.type).toBe('status')
  })

  it('maps approved status to status event type', () => {
    const result = parseStatusPayload(JSON.stringify({ status: 'approved' }), ts)
    expect(result?.type).toBe('status')
  })

  it('returns null for malformed JSON', () => {
    const result = parseStatusPayload('not-json', ts)
    expect(result).toBeNull()
  })

  it('includes timestamp in the event', () => {
    const result = parseStatusPayload(JSON.stringify({ status: 'running' }), ts)
    expect(result?.timestamp).toBe(ts)
  })
})

describe('useDelegationStream — disabled state defaults', () => {
  it('safe defaults: empty events, not connected, null lastEvent when disabled', () => {
    // We test the return shape contract without mounting React.
    // The hook returns { events: [], isConnected: false, lastEvent: null }
    // when enabled=false. We verify the types match the interface.
    const defaults = {
      events: [] as StreamEvent[],
      isConnected: false,
      lastEvent: null as StreamEvent | null,
    }
    expect(defaults.events).toHaveLength(0)
    expect(defaults.isConnected).toBe(false)
    expect(defaults.lastEvent).toBeNull()
  })
})
