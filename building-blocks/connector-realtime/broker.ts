/**
 * Realtime connector — in-process pub/sub broker backing Server-Sent Events.
 * Zero external deps: works for a single Node instance (dev + small prod).
 * For multi-instance, back publish() with Redis pub/sub or Supabase Realtime.
 *
 * Destination: src/lib/realtime/broker.ts
 */

export interface RealtimeEvent {
  channel: string
  /** Event name (the SSE "event:" field). */
  type: string
  /** JSON-serializable payload. */
  data: unknown
}

type Subscriber = (event: RealtimeEvent) => void

class Broker {
  private subscribers = new Map<string, Set<Subscriber>>()

  subscribe(channel: string, fn: Subscriber): () => void {
    let set = this.subscribers.get(channel)
    if (!set) { set = new Set(); this.subscribers.set(channel, set) }
    set.add(fn)
    return () => {
      set?.delete(fn)
      if (set && set.size === 0) this.subscribers.delete(channel)
    }
  }

  publish(channel: string, type: string, data: unknown): void {
    const event: RealtimeEvent = { channel, type, data }
    this.subscribers.get(channel)?.forEach(fn => {
      try { fn(event) } catch { /* one bad subscriber must not break the rest */ }
    })
  }

  subscriberCount(channel: string): number {
    return this.subscribers.get(channel)?.size ?? 0
  }
}

// Survive Next.js dev hot-reloads by stashing the broker on globalThis.
const g = globalThis as unknown as { __realtimeBroker?: Broker }
export const broker: Broker = g.__realtimeBroker ?? new Broker()
if (process.env.NODE_ENV !== 'production') g.__realtimeBroker = broker
