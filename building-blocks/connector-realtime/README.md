# Realtime Connector (SSE)

Push live updates to the browser with Server-Sent Events — zero external deps,
no client library. Good for boards, dashboards, notifications, presence.

## Files
- `src/lib/realtime/broker.ts` — in-process pub/sub (survives dev hot-reload)
- `src/app/api/realtime/[channel]/route.ts` — SSE stream endpoint
- `src/lib/realtime/useEventStream.ts` — client hook

## Usage
Server (after a mutation):
```ts
import { broker } from '@/lib/realtime/broker'
broker.publish(`board-${boardId}`, 'task.updated', task)
```
Client:
```tsx
const { last } = useEventStream<Task>(`/api/realtime/board-${boardId}`, 'task.updated')
```

**Scaling:** the broker is per-instance. For multiple instances, back
`publish()` with Redis pub/sub or swap to Supabase Realtime (supabase connector).
Always auth + authorize the channel in the route before production.
